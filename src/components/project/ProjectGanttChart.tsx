/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Task, User, Project } from "../../types/index.js";
import { useUIStore } from "../../store/ui-store.js";
import { 
  GitMerge, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  Plus, 
  X,
  Sparkles,
  Link2,
  Trash2
} from "lucide-react";

interface ProjectGanttChartProps {
  tasks: Task[];
  users: User[];
  project: Project;
  onTaskUpdated: () => void;
}

export function ProjectGanttChart({ tasks, users, project, onTaskUpdated }: ProjectGanttChartProps) {
  const token = useUIStore((state) => state.token);
  const navigate = useUIStore((state) => state.navigate);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Parse Project Date Limits
  const dateBounds = useMemo(() => {
    let start = project.startDate ? new Date(project.startDate) : null;
    let end = project.endDate ? new Date(project.endDate) : null;

    // Fallbacks if missing
    if (!start || isNaN(start.getTime())) {
      start = new Date();
      start.setDate(start.getDate() - 2);
    }
    if (!end || isNaN(end.getTime())) {
      end = new Date(start.getTime());
      end.setDate(end.getDate() + 30);
    }

    // Adjust if tasks fall outside Project limits
    const activeTasks = tasks.filter(t => !t.deleted);
    activeTasks.forEach(task => {
      if (task.dueDate) {
        const d = new Date(task.dueDate);
        if (!isNaN(d.getTime())) {
          if (d < start!) start = new Date(d.getTime() - 2 * 24 * 60 * 60 * 1000);
          if (d > end!) end = new Date(d.getTime() + 2 * 24 * 60 * 60 * 1000);
        }
      }
    });

    const diffMs = end.getTime() - start.getTime();
    let daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    // Limits
    if (daysDiff <= 0) daysDiff = 14;
    if (daysDiff > 120) daysDiff = 120; // safe capping

    const days: string[] = [];
    for (let i = 0; i <= daysDiff; i++) {
      const nextDay = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      days.push(nextDay.toISOString().split("T")[0]);
    }

    return {
      startDateStr: start.toISOString().split("T")[0],
      endDateStr: end.toISOString().split("T")[0],
      days,
      startDay: start
    };
  }, [project.startDate, project.endDate, tasks]);

  const activeTasks = useMemo(() => tasks.filter(t => !t.deleted), [tasks]);

  // Translate a task into coordinate spaces
  const taskGanttItems = useMemo(() => {
    return activeTasks.map((task, idx) => {
      const dueStr = task.dueDate || dateBounds.endDateStr;
      const dueIndex = dateBounds.days.indexOf(dueStr);
      
      // Assume a 4-day duration for visual bars if start isn't tracked
      let durationInDays = 3; 
      let startIndex = dueIndex - durationInDays;
      if (startIndex < 0) {
        startIndex = 0;
        durationInDays = dueIndex >= 0 ? dueIndex : 0;
      }

      return {
        task,
        rowIndex: idx,
        startIndex: startIndex >= 0 ? startIndex : 0,
        dueIndex: dueIndex >= 0 ? dueIndex : dateBounds.days.length - 1,
        duration: durationInDays
      };
    });
  }, [activeTasks, dateBounds]);

  const dayWidth = 48; // width in pixels for each day column
  const rowHeight = 52; // height in pixels for each task row
  const rightCalendarWidth = dateBounds.days.length * dayWidth;

  // Render connector curves dynamically mathematically
  const svgConnectors = useMemo(() => {
    const lines: {
      path: string;
      preId: string;
      sucId: string;
      isHighlighted: boolean;
      isCompleted: boolean;
    }[] = [];

    taskGanttItems.forEach((sucItem) => {
      const deps = sucItem.task.dependencies || [];
      deps.forEach((preId) => {
        const preItem = taskGanttItems.find(item => item.task.id === preId);
        if (preItem) {
          // X, Y calculation
          // Predecessor ends at (preItem.dueIndex + 1) * dayWidth
          const xPre = (preItem.dueIndex + 0.95) * dayWidth;
          const yPre = preItem.rowIndex * rowHeight + rowHeight / 2;

          // Successor starts at sucItem.startIndex * dayWidth
          const xSuc = (sucItem.startIndex + 0.05) * dayWidth;
          const ySuc = sucItem.rowIndex * rowHeight + rowHeight / 2;

          // Compute spline offsets
          const dx = xSuc - xPre;
          const cpX1 = xPre + Math.max(20, dx * 0.4);
          const cpX2 = xSuc - Math.max(20, dx * 0.4);

          // Path bezier spline
          const path = `M ${xPre} ${yPre} C ${cpX1} ${yPre}, ${cpX2} ${ySuc}, ${xSuc} ${ySuc}`;

          const isHighlighted = hoveredTaskId === preId || hoveredTaskId === sucItem.task.id;
          const isCompleted = preItem.task.status === "Done";

          lines.push({
            path,
            preId,
            sucId: sucItem.task.id,
            isHighlighted,
            isCompleted
          });
        }
      });
    });

    return lines;
  }, [taskGanttItems, hoveredTaskId, dayWidth, rowHeight]);

  // Connect helper directly within Gantt view
  const handleToggleDependency = async (taskId: string, depId: string) => {
    if (!token) return;
    const taskObj = activeTasks.find(t => t.id === taskId);
    if (!taskObj) return;

    const currentDeps = taskObj.dependencies || [];
    const updated = currentDeps.includes(depId)
      ? currentDeps.filter(id => id !== depId)
      : [...currentDeps, depId];

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ dependencies: updated })
      });
      if (res.ok) {
        onTaskUpdated();
      } else {
        const err = await res.json();
        alert(`Failed updating dependency: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Done":
        return "bg-emerald-500 border-emerald-600 shadow-emerald-100";
      case "Review":
        return "bg-amber-400 border-amber-500 shadow-amber-100";
      case "In Progress":
        return "bg-indigo-500 border-indigo-600 shadow-indigo-100";
      default:
        return "bg-slate-400 border-slate-500 shadow-slate-100";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "bg-red-100 text-red-700 border-red-200";
      case "High":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "Medium":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const selectedTaskObj = activeTasks.find(t => t.id === selectedTaskId);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs font-sans">
      
      {/* Control panel header */}
      <div className="p-4 border-b border-slate-150 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-500">
          <GitMerge className="w-4.5 h-4.5 text-theme-purple" />
          <span>Interactive Dependency Roadmaps Scheduled Range:</span>
          <span className="bg-white px-2.5 py-1 border rounded text-slate-800">
            {dateBounds.startDateStr} → {dateBounds.endDateStr}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center space-x-3 select-none">
          <div className="flex items-center space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>To Do</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Review</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Done</span>
          </div>
        </div>
      </div>

      {activeTasks.length === 0 ? (
        <div className="py-24 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No scheduled tasks yet</p>
          <p className="text-xs text-slate-400 mt-1">Gantt roadmap will render once items are written to the boards.</p>
        </div>
      ) : (
        <div className="flex select-none relative overflow-hidden">
          
          {/* Left Side: Tasks Row Title Grid */}
          <div className="w-36 sm:w-64 md:w-80 border-r border-slate-200 shrink-0 bg-white relative z-10 flex flex-col shadow-lg">
            {/* Corner header day/weekly cell */}
            <div className="h-14 border-b border-slate-200 bg-slate-50 p-4 flex items-center justify-between text-xs font-bold text-slate-650 uppercase font-mono tracking-wider shrink-0">
              <span>Task sheets titles</span>
              <span className="hidden sm:inline-block">Lane</span>
            </div>

            {/* Task list rows */}
            <div className="divide-y divide-slate-100 overflow-hidden">
              {taskGanttItems.map(({ task }) => (
                <div
                  key={task.id}
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                  className={`h-[52px] px-4 flex items-center justify-between cursor-pointer transition-all ${
                    selectedTaskId === task.id ? "bg-theme-purple/5" : hoveredTaskId === task.id ? "bg-slate-50" : "bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`tasks/${task.id}`);
                      }}
                      className="block text-xs font-bold text-slate-800 truncate hover:underline hover:text-indigo-600"
                    >
                      {task.title}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Due: {task.dueDate} / {task.estimatedHours}h
                    </span>
                  </div>
                  <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline-block ${
                    task.status === "Done" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                    task.status === "Review" ? "bg-amber-50 border-amber-200 text-amber-700" :
                    task.status === "In Progress" ? "bg-indigo-50 border-indigo-200 text-indigo-700" :
                    "bg-slate-50 border-slate-200 text-slate-500"
                  }`}>
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Timeline scrolling grid */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden relative bg-slate-50/50">
            {/* Calendar scale header row */}
            <div className="h-14 border-b border-slate-200 bg-slate-50/90 backdrop-blur-xs flex divide-x divide-slate-200/60 shrink-0 sticky top-0" style={{ width: rightCalendarWidth }}>
              {dateBounds.days.map((dayStr, idx) => {
                const dayParts = dayStr.split("-");
                const dayLabel = `${dayParts[1]}/${dayParts[2]}`;
                const dt = new Date(dayStr);
                const dayOfWeek = dt.toLocaleDateString([], { weekday: 'short' });
                const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;

                return (
                  <div 
                    key={dayStr} 
                    className={`w-12 h-full flex flex-col items-center justify-center text-[10px] font-mono font-bold shrink-0 py-1.5 leading-none ${
                      isWeekend ? "bg-slate-100 text-slate-400" : "text-slate-600"
                    }`}
                  >
                    <span>{dayOfWeek}</span>
                    <span className="mt-1 text-[11px] font-sans font-extrabold">{dayParts[2]}</span>
                  </div>
                );
              })}
            </div>

            {/* Content area holding bars & connector lines */}
            <div className="relative divide-y divide-slate-100" style={{ width: rightCalendarWidth, height: taskGanttItems.length * rowHeight }}>
              
              {/* Grid Column lines Background */}
              <div className="absolute inset-0 flex pointer-events-none select-none divide-x divide-slate-100">
                {dateBounds.days.map((dayStr) => {
                  const dt = new Date(dayStr);
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  return (
                    <div 
                      key={`bg-col-${dayStr}`} 
                      className={`w-12 h-full shrink-0 ${isWeekend ? "bg-slate-100/30" : ""}`} 
                    />
                  );
                })}
              </div>

              {/* SVG Connectors Container Canvas Overlay */}
              <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: rightCalendarWidth, height: taskGanttItems.length * rowHeight }}>
                {/* Arrow markers definitions */}
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#64748b" />
                  </marker>
                  <marker id="arrow-glow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#d97706" />
                  </marker>
                </defs>

                {svgConnectors.map(({ path, preId, sucId, isHighlighted, isCompleted }, idx) => (
                  <g key={`spline-${idx}`}>
                    {/* Shadow halo for selection feedback */}
                    {isHighlighted && (
                      <path
                        d={path}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="5.5"
                        strokeLinecap="round"
                        className="opacity-40 animate-pulse"
                      />
                    )}
                    {/* Core spline connector line */}
                    <path
                      d={path}
                      fill="none"
                      stroke={isHighlighted ? "#d97706" : isCompleted ? "#cbd5e1" : "#94a3b8"}
                      strokeWidth={isHighlighted ? "2.5" : "1.5"}
                      strokeDasharray={isCompleted ? "0" : "4 2"}
                      strokeLinecap="round"
                      markerEnd={isHighlighted ? "url(#arrow-glow)" : "url(#arrow)"}
                      className="transition-all duration-150"
                    />
                  </g>
                ))}
              </svg>

              {/* Task Horizontal Bars */}
              {taskGanttItems.map(({ task, rowIndex, startIndex, dueIndex, duration }) => {
                const isHovered = hoveredTaskId === task.id;
                const isSelected = selectedTaskId === task.id;
                const hasBlockers = (task.dependencies || []).length > 0;

                // Position variables
                const leftPos = startIndex * dayWidth;
                const barWidth = Math.max(dayWidth, (dueIndex - startIndex + 1) * dayWidth);

                return (
                  <div
                    key={`row-${task.id}`}
                    className="h-[52px] relative flex items-center z-10 pointer-events-none"
                  >
                    {/* HTML Event Trigger Element container block */}
                    <div
                      onMouseEnter={() => setHoveredTaskId(task.id)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                      onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                      className={`absolute pointer-events-auto cursor-pointer rounded-xl border flex items-center justify-between px-3.5 transition-all text-[11px] font-bold text-white shadow-xs ${getStatusColor(task.status)} ${
                        isHovered ? "scale-[1.02] shadow-md brightness-105 z-20" : ""
                      } ${isSelected ? "ring-2 ring-theme-purple ring-offset-2 z-2 z-20" : ""}`}
                      style={{
                        left: leftPos + 5,
                        width: barWidth - 10,
                        height: "34px",
                      }}
                    >
                      <div className="truncate pr-1 flex items-center space-x-1">
                        {hasBlockers && <GitMerge className="w-3.5 h-3.5 mr-0.5 inline shrink-0 animate-pulse text-amber-100" />}
                        <span className="truncate">{task.title}</span>
                      </div>
                      <span className="text-[9px] opacity-80 shrink-0 font-mono hidden sm:inline">
                        {task.estimatedHours}h
                      </span>
                    </div>
                  </div>
                );
              })}

            </div>
          </div>

        </div>
      )}

      {/* Slide-out dependency links and blocker connection details */}
      {selectedTaskId && selectedTaskObj && (
        <div className="p-5 border-t border-slate-150 bg-slate-50/80 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom duration-150">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-rose-100">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                <Link2 className="w-4 h-4 text-theme-purple" />
                <span>Roadmap connection editor</span>
              </h4>
              <button 
                onClick={() => setSelectedTaskId(null)}
                className="p-1 hover:bg-slate-200 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs font-semibold text-slate-705 mt-2.5">
              Editing: <span className="font-extrabold text-slate-900">"{selectedTaskObj.title}"</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
              Task completion is gated/blocked by prerequisite links. Clear blocking items first.
            </p>

            <div className="mt-3.5">
              <span className="block text-[10px] font-bold font-mono uppercase text-slate-400 mb-1.5">Prerequisites blocking this</span>
              {(selectedTaskObj.dependencies || []).length > 0 ? (
                <div className="space-y-1.5 Max-h-40 overflow-y-auto">
                  {selectedTaskObj.dependencies!.map((depId) => {
                    const dObj = activeTasks.find(t => t.id === depId);
                    if (!dObj) return null;
                    return (
                      <div key={depId} className="flex items-center justify-between p-2 bg-white rounded-lg border text-xs leading-none">
                        <span className="truncate font-semibold text-slate-700">{dObj.title}</span>
                        <button
                          onClick={() => handleToggleDependency(selectedTaskObj.id, depId)}
                          className="text-[9.5px] text-pink-600 hover:underline font-mono ml-2 shrink-0 font-bold"
                        >
                          Disconnect
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No preceding task requirements locked in.</p>
              )}
            </div>
          </div>

          <div className="md:border-l md:border-slate-200 md:pl-6 pt-4 md:pt-0">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Link prerequisites blocker relationship
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">
              Prevent team members from setting status to Done until prerequisites compile successfully.
            </p>

            <div className="mt-4">
              {activeTasks.filter(t => t.id !== selectedTaskObj.id && !(selectedTaskObj.dependencies || []).includes(t.id)).length > 0 ? (
                <div className="relative">
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        handleToggleDependency(selectedTaskObj.id, val);
                        e.target.value = ""; // clear
                      }
                    }}
                    className="w-full text-xs font-mono bg-white border border-slate-200 p-2 rounded-lg cursor-pointer text-slate-700 focus:ring-1 focus:ring-theme-purple focus:outline-none focus:border-theme-purple font-bold"
                    defaultValue=""
                  >
                    <option value="">-- Choose target pre-requisite task --</option>
                    {activeTasks
                      .filter(t => t.id !== selectedTaskObj.id && !(selectedTaskObj.dependencies || []).includes(t.id))
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          [{t.category}] {t.title} ({t.status})
                        </option>
                      ))
                    }
                  </select>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic font-mono mt-2">
                  All alternative project board tasks already link to this scheduler item!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

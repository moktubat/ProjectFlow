/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Task, User, Project } from "../../types/index.js";
import { useUIStore } from "../../store/ui-store.js";
import { 
  TrendingDown, 
  Users, 
  BarChart4, 
  PieChart, 
  Clock, 
  Zap, 
  ShieldAlert, 
  CheckCircle,
  Clock4,
  RefreshCw,
  FolderLock
} from "lucide-react";

interface ProjectSprintAnalyticsProps {
  tasks: Task[];
  users: User[];
  project: Project;
}

export function ProjectSprintAnalytics({ tasks, users, project }: ProjectSprintAnalyticsProps) {
  const token = useUIStore((state) => state.token);
  const [activeMetricTab, setActiveMetricTab] = useState<"burndown" | "workload" | "breakout">("burndown");
  const [burndownHoverIndex, setBurndownHoverIndex] = useState<number | null>(null);

  const activeTasks = useMemo(() => tasks.filter(t => !t.deleted), [tasks]);

  // Overall KPI Calcs
  const kpis = useMemo(() => {
    const totalCount = activeTasks.length;
    const completedCount = activeTasks.filter(t => t.status === "Done").length;
    const completePercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    const totalEstimate = activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalLogged = activeTasks.reduce((sum, t) => {
      return sum + t.timeLogs.reduce((acc, log) => acc + log.hours, 0);
    }, 0);

    // Overdue tasks
    const now = new Date();
    const overdueCount = activeTasks.filter(t => {
      if (t.status === "Done") return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return !isNaN(due.getTime()) && due < now;
    }).length;

    // Average project velocity
    const daysDuration = 30; // default range divisor
    const velocityPerDay = daysDuration > 0 ? (totalLogged / daysDuration).toFixed(1) : "0";

    return {
      totalCount,
      completedCount,
      completePercentage,
      totalEstimate,
      totalLogged,
      overdueCount,
      velocityPerDay
    };
  }, [activeTasks]);

  // Status Breakout Analytics
  const statusData = useMemo(() => {
    const todo = activeTasks.filter(t => t.status === "To Do").length;
    const progress = activeTasks.filter(t => t.status === "In Progress").length;
    const review = activeTasks.filter(t => t.status === "Review").length;
    const done = activeTasks.filter(t => t.status === "Done").length;
    const total = activeTasks.length || 1;

    return [
      { name: "To Do", count: todo, pct: Math.round((todo / total) * 100), color: "#94a3b8" },
      { name: "In Progress", count: progress, pct: Math.round((progress / total) * 100), color: "#6366f1" },
      { name: "Review", count: review, pct: Math.round((review / total) * 100), color: "#fbbf24" },
      { name: "Done", count: done, pct: Math.round((done / total) * 100), color: "#10b981" }
    ];
  }, [activeTasks]);

  // Category Distribution
  const categoryData = useMemo(() => {
    const counts: { [cat: string]: number } = {};
    activeTasks.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    const total = activeTasks.length || 1;
    return Object.keys(counts).map(cat => ({
      category: cat,
      count: counts[cat],
      pct: Math.round((counts[cat] / total) * 100)
    })).sort((a, b) => b.count - a.count);
  }, [activeTasks]);

  // Resource / Assignee Workload Balance Analyzer
  const memberWorkloads = useMemo(() => {
    return users.map(user => {
      // Find tasks where this user is assigned
      const assigned = activeTasks.filter(t => 
        t.assignees.some(asg => asg.userId === user.id)
      );

      const tasksCount = assigned.length;
      const completedCount = assigned.filter(t => t.status === "Done").length;
      const completeRatio = tasksCount > 0 ? Math.round((completedCount / tasksCount) * 100) : 0;
      
      const estimatedHours = assigned.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
      const loggedHours = assigned.reduce((sum, t) => {
        return sum + t.timeLogs.reduce((acc, log) => acc + log.hours, 0);
      }, 0);

      const isOverloaded = estimatedHours >= 30; // standard 30h capacity limit per sprint

      return {
        user,
        tasksCount,
        completeRatio,
        estimatedHours,
        loggedHours,
        isOverloaded
      };
    }).sort((a, b) => b.estimatedHours - a.estimatedHours);
  }, [users, activeTasks]);

  // Compute Agile burndown datasets over project scope (ideal line vs. actual remaining hours)
  const burndownData = useMemo(() => {
    let start = project.startDate ? new Date(project.startDate) : null;
    let end = project.endDate ? new Date(project.endDate) : null;

    if (!start || isNaN(start.getTime())) {
      start = new Date();
      start.setDate(start.getDate() - 2);
    }
    if (!end || isNaN(end.getTime())) {
      end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    }

    const diffMs = end.getTime() - start.getTime();
    let daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (daysDiff <= 0) daysDiff = 14;
    if (daysDiff > 45) daysDiff = 45; // clamp for clean graphing

    const totalEstimatedHours = activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

    const data: {
      dayIndex: number;
      dateStr: string;
      idealHoursRemaining: number;
      actualHoursRemaining: number;
    }[] = [];

    for (let i = 0; i <= daysDiff; i++) {
      const currentDay = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const curDayStr = currentDay.toISOString().split("T")[0];

      // Ideal straight trajectory line calculation
      const ideal = Math.max(0, parseFloat((totalEstimatedHours * (1 - i / daysDiff)).toFixed(1)));

      // Actual calculation: remaining estimate sum of incomplete tasks on/before this day
      // A task is considered "complete" at the due date if it is Done
      let actual = totalEstimatedHours;
      activeTasks.forEach(t => {
        if (t.status === "Done") {
          // If task was completed (due date parsed) on or before this index day, reduce the balance
          if (t.dueDate && t.dueDate <= curDayStr) {
            actual -= (t.estimatedHours || 0);
          }
        }
      });

      // Clamp actual hours remaining above zero
      if (actual < 0) actual = 0;

      // Adjust trend so actual is flat or falling
      if (i === daysDiff && activeTasks.filter(t => t.status !== "Done").length === 0) {
        actual = 0;
      }

      data.push({
        dayIndex: i,
        dateStr: curDayStr,
        idealHoursRemaining: ideal,
        actualHoursRemaining: actual
      });
    }

    return data;
  }, [project.startDate, project.endDate, activeTasks]);

  // Construct SVG parameters for the Burndown chart dynamically
  const burndownChartSvg = useMemo(() => {
    if (burndownData.length === 0) return null;
    
    const width = 640;
    const height = 280;
    const padding = 40;

    const maxHours = Math.max(kpis.totalEstimate || 10, ...burndownData.map(d => Math.max(d.idealHoursRemaining, d.actualHoursRemaining)));
    const length = burndownData.length;

    // Scaling helpers
    const getX = (index: number) => padding + (index / (length - 1)) * (width - 2 * padding);
    const getY = (hours: number) => height - padding - (hours / maxHours) * (height - 2 * padding);

    // Create Ideal Line Path
    let idealPath = "";
    burndownData.forEach((d, idx) => {
      const x = getX(d.dayIndex);
      const y = getY(d.idealHoursRemaining);
      idealPath += `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    });

    // Create Actual Line Path
    let actualPath = "";
    burndownData.forEach((d, idx) => {
      const x = getX(d.dayIndex);
      const y = getY(d.actualHoursRemaining);
      actualPath += `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    });

    // Generate grid line y-values
    const gridY: number[] = [];
    const step = maxHours / 4;
    for (let i = 0; i <= 4; i++) {
      gridY.push(parseFloat((i * step).toFixed(0)));
    }

    return {
      width,
      height,
      padding,
      idealPath,
      actualPath,
      getX,
      getY,
      gridY,
      maxHours
    };
  }, [burndownData, kpis.totalEstimate]);

  return (
    <div className="space-y-6">
      
      {/* 4-KPI Overview Panels row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">Completion rate</span>
            <span className="text-xl md:text-2xl font-black text-slate-800 leading-tight block mt-0.5">{kpis.completePercentage}%</span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{kpis.completedCount} / {kpis.totalCount} completed</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">Total volume</span>
            <span className="text-xl md:text-2xl font-black text-slate-800 leading-tight block mt-0.5">{kpis.totalEstimate}h</span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{kpis.totalLogged}h actual log written</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex items-center space-x-4">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-500 shrink-0">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">Overdue items</span>
            <span className={`text-xl md:text-2xl font-black leading-tight block mt-0.5 ${kpis.overdueCount > 0 ? "text-pink-650" : "text-slate-800"}`}>
              {kpis.overdueCount} Items
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Slipped past planned deadline</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex items-center space-x-4">
          <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl text-sky-600 shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">Burn velocity</span>
            <span className="text-xl md:text-2xl font-black text-slate-800 leading-tight block mt-0.5">{kpis.velocityPerDay}h/day</span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Average logged effort rate</span>
          </div>
        </div>
      </div>

      {/* Main interactive Tab controller */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Navigation bar */}
        <div className="flex border-b border-slate-150 bg-slate-50 p-1.5 space-x-1 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveMetricTab("burndown")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all inline-flex items-center space-x-1.5 font-display ${
              activeMetricTab === "burndown"
                ? "bg-white text-indigo-700 shadow-2xs font-extrabold border border-slate-200"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>Burndown trajectory</span>
          </button>
          
          <button
            onClick={() => setActiveMetricTab("workload")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all inline-flex items-center space-x-1.5 font-display ${
              activeMetricTab === "workload"
                ? "bg-white text-indigo-700 shadow-2xs font-extrabold border border-slate-200"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Resource balance workloads</span>
          </button>

          <button
            onClick={() => setActiveMetricTab("breakout")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all inline-flex items-center space-x-1.5 font-display ${
              activeMetricTab === "breakout"
                ? "bg-white text-indigo-700 shadow-2xs font-extrabold border border-slate-200"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <BarChart4 className="w-4 h-4" />
            <span>Status distribution</span>
          </button>
        </div>

        {/* Content body based on active tabs */}
        <div className="p-6">
          
          {/* Burndown траектория */}
          {activeMetricTab === "burndown" && burndownChartSvg && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Sprint Burndown Timeline</h4>
                  <p className="text-slate-400 text-[10px] mt-0.5">Compares planned ideal task effort expenditure vs actual board completions</p>
                </div>
                <div className="text-[10px] font-mono font-bold flex items-center space-x-4">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-3 h-0.5 border-t-2 border-slate-300 border-dashed" />
                    <span>Ideal Burndown Trajectory</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-3 h-1 bg-indigo-500 rounded" />
                    <span>Actual Remaining Estimate</span>
                  </div>
                </div>
              </div>

              {kpis.totalEstimate === 0 ? (
                <div className="py-12 text-center text-slate-400 italic text-xs">
                  Provide estimated hours on tasks sheets to populate remaining burndown charts.
                </div>
              ) : (
                <div className="relative border border-slate-150 rounded-xl p-3 bg-slate-50/50 flex justify-center">
                  <svg 
                    viewBox={`0 0 ${burndownChartSvg.width} ${burndownChartSvg.height}`} 
                    className="w-full max-w-4xl h-auto"
                  >
                    {/* Grid horizontal guidelines */}
                    {burndownChartSvg.gridY.map((hours, idx) => {
                      const y = burndownChartSvg.getY(hours);
                      return (
                        <g key={`guide-${idx}`}>
                          <line 
                            x1={burndownChartSvg.padding} 
                            y1={y} 
                            x2={burndownChartSvg.width - burndownChartSvg.padding} 
                            y2={y} 
                            stroke="#e2e8f0" 
                            strokeWidth="1" 
                          />
                          <text 
                            x={burndownChartSvg.padding - 8} 
                            y={y + 3} 
                            fill="#94a3b8" 
                            fontSize="9" 
                            fontFamily="monospace"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            {hours}h
                          </text>
                        </g>
                      );
                    })}

                    {/* Timeline Vertical grid tick helpers */}
                    {burndownData.map((d, idx) => {
                      const x = burndownChartSvg.getX(idx);
                      // Only show labels occasionally for clean reading
                      const showLabel = idx === 0 || idx === burndownData.length - 1 || idx % 7 === 0;
                      return (
                        <g key={`v-grid-${idx}`}>
                          {idx !== 0 && idx !== burndownData.length - 1 && (
                            <line 
                              x1={x} 
                              y1={burndownChartSvg.padding} 
                              x2={x} 
                              y2={burndownChartSvg.height - burndownChartSvg.padding} 
                              stroke="#f1f5f9" 
                              strokeWidth="1" 
                            />
                          )}
                          {showLabel && (
                            <text 
                              x={x} 
                              y={burndownChartSvg.height - burndownChartSvg.padding + 14} 
                              fill="#94a3b8" 
                              fontSize="8" 
                              fontFamily="monospace"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              Day {idx}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Path: Ideal trajectory dashed */}
                    <path
                      d={burndownChartSvg.idealPath}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />

                    {/* Path: Actual Remaining hours */}
                    <path
                      d={burndownChartSvg.actualPath}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Hover Hotspot Circles for interaction */}
                    {burndownData.map((d, idx) => {
                      const x = burndownChartSvg.getX(idx);
                      const yIdeal = burndownChartSvg.getY(d.idealHoursRemaining);
                      const yActual = burndownChartSvg.getY(d.actualHoursRemaining);

                      return (
                        <g 
                          key={`hotspot-${idx}`}
                          onMouseEnter={() => setBurndownHoverIndex(idx)}
                          onMouseLeave={() => setBurndownHoverIndex(null)}
                          className="cursor-pointer"
                        >
                          {/* Ideal node circle */}
                          <circle 
                            cx={x} 
                            cy={yActual} 
                            r={burndownHoverIndex === idx ? "7" : "3.5"} 
                            fill="#6366f1" 
                            stroke="white" 
                            strokeWidth="1.5" 
                            className="transition-all duration-100"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Tooltip detail element */}
                  {burndownHoverIndex !== null && burndownData[burndownHoverIndex] && (
                    <div className="absolute top-4 left-6 bg-slate-900 text-white rounded-lg p-2.5 shadow-xl border border-slate-700 text-[10px] font-mono leading-relaxed space-y-0.5 max-w-xs block scale-in duration-100 pointer-events-none">
                      <p className="font-bold text-slate-350 uppercase">Burn progress index:</p>
                      <p className="font-sans font-extrabold text-[#9da5fc] text-[11px]">Sprint Day {burndownHoverIndex} ({burndownData[burndownHoverIndex].dateStr})</p>
                      <div className="pt-1 mt-1 border-t border-slate-700 space-y-0.5 font-bold">
                        <p>Planned trajectory: <span className="text-white">{burndownData[burndownHoverIndex].idealHoursRemaining}h</span></p>
                        <p>Actual outstanding: <span className="text-emerald-400">{burndownData[burndownHoverIndex].actualHoursRemaining}h</span></p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Resource Workload Balance charts list */}
          {activeMetricTab === "workload" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Squad allocation workloads</h4>
                <p className="text-slate-400 text-[10px] mt-0.5">Track estimated hours volume per assignee. Caps recommended at 30h to prevent burnouts.</p>
              </div>

              {memberWorkloads.length === 0 ? (
                <p className="text-xs text-slate-405 italic">No approved system project participants available to load.</p>
              ) : (
                <div className="space-y-4">
                  {memberWorkloads.map(({ user, tasksCount, completeRatio, estimatedHours, loggedHours, isOverloaded }) => (
                    <div key={user.id} className={`p-4 rounded-2xl border transition-all ${
                      isOverloaded ? "bg-red-50/20 border-red-200" : "bg-slate-50/50 border-slate-200/50 hover:bg-slate-50"
                    }`}>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        {/* Name circle */}
                        <div className="flex items-center space-x-3 pr-2">
                          <div className={`w-8 h-8 rounded-full border text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-2xs ${
                            isOverloaded ? "bg-red-100 border-red-300 text-red-700" : "bg-indigo-50 border-slate-300"
                          }`}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-805">{user.name}</span>
                            <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wide">
                              Role: {user.role} / Team ID: {user.teamId || "No team link"}
                            </span>
                          </div>
                        </div>

                        {/* Overload badge flag */}
                        {isOverloaded && (
                          <div className="px-2.5 py-0.5 rounded-full border border-pink-200 bg-pink-100 text-[9px] font-mono font-bold text-pink-700 uppercase animate-bounce mt-1 shrink-0 flex items-center space-x-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Sprint Overloaded (30h Limit)</span>
                          </div>
                        )}

                        {/* Mini workload numeric gauges */}
                        <div className="flex items-center space-x-6 text-[10px] font-mono uppercase text-slate-500 font-bold">
                          <div>
                            <span className="block text-slate-400 text-[9px]">Sheets</span>
                            <span className="text-slate-800 text-xs font-black">{tasksCount} linked</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[9px]">Scope estimate</span>
                            <span className={`text-xs font-black ${isOverloaded ? "text-red-655" : "text-slate-800"}`}>
                              {estimatedHours} hours
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[9px]">Logged code</span>
                            <span className="text-slate-800 text-xs font-black">{loggedHours} hours</span>
                          </div>
                        </div>
                      </div>

                      {/* Bar workload visuals */}
                      <div className="mt-3.5 space-y-1.5 select-none">
                        <div className="flex justify-between items-center text-[9px] font-mono font-extrabold text-slate-450 uppercase">
                          <span>Sprint Progress Completion Percentage</span>
                          <span>{completeRatio}% done</span>
                        </div>
                        <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOverloaded ? "bg-pink-500" : "bg-theme-teal"
                            }`}
                            style={{ width: `${completeRatio}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Breakout Data panels list */}
          {activeMetricTab === "breakout" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Lane ratios */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Lanes progress distribution</h4>
                  <p className="text-slate-450 text-[10.1px]">Status lane counts indicating current board bottleneck positions</p>
                </div>

                <div className="space-y-3 pt-2">
                  {statusData.map((lane) => (
                    <div key={lane.name} className="space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: lane.color }} />
                          <span>{lane.name}</span>
                        </span>
                        <span>{lane.count} ({lane.pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${lane.pct}%`, backgroundColor: lane.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category charts listing */}
              <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-150 pt-4 md:pt-0 md:pl-8">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Workforce categories breakdown</h4>
                  <p className="text-slate-450 text-[10.1px]">Task counts categorizing workforce assignments</p>
                </div>

                {categoryData.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tasks categorized yet.</p>
                ) : (
                  <div className="space-y-3 pt-2.5">
                    {categoryData.map((catObj) => (
                      <div key={catObj.category} className="space-y-1 text-xs">
                        <div className="flex justify-between font-bold text-slate-700 uppercase">
                          <span>{catObj.category}</span>
                          <span>{catObj.count} ({catObj.pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full bg-indigo-400 rounded-full transition-all duration-300"
                            style={{ width: `${catObj.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>

    </div>
  );
}

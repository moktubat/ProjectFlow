import React, { useState, useMemo } from "react";
import { Task, User, Project } from "../../types/index.js";
import { useUIStore } from "../../store/ui-store.js";
import { GitMerge, Calendar, X, Link2 } from "lucide-react";

interface ProjectGanttChartProps {
  tasks: Task[];
  users: User[];
  project: Project;
  onTaskUpdated: () => void;
}

export function ProjectGanttChart({ tasks, users, project, onTaskUpdated }: ProjectGanttChartProps) {
  const token = useUIStore((s) => s.token);
  const navigate = useUIStore((s) => s.navigate);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeTasks = useMemo(() => tasks.filter((t) => !t.deleted), [tasks]);

  const dateBounds = useMemo(() => {
    let start = project.startDate ? new Date(project.startDate) : new Date();
    let end = project.endDate ? new Date(project.endDate) : new Date(Date.now() + 30 * 86400000);
    if (isNaN(start.getTime())) start = new Date();
    if (isNaN(end.getTime())) end = new Date(Date.now() + 30 * 86400000);

    activeTasks.forEach((t) => {
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (!isNaN(d.getTime())) {
          if (d < start) start = new Date(d.getTime() - 2 * 86400000);
          if (d > end) end = new Date(d.getTime() + 2 * 86400000);
        }
      }
    });

    let diff = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    if (diff <= 0) diff = 14;
    if (diff > 90) diff = 90;

    const days: string[] = [];
    for (let i = 0; i <= diff; i++) {
      days.push(new Date(start.getTime() + i * 86400000).toISOString().split("T")[0]);
    }
    return { days, startDay: start };
  }, [project, activeTasks]);

  const DAY_W = 44;
  const ROW_H = 48;

  const items = useMemo(() => activeTasks.map((task, idx) => {
    const dueIdx = dateBounds.days.indexOf(task.dueDate ?? dateBounds.days[dateBounds.days.length - 1]);
    const dur = 3;
    const startIdx = Math.max(0, dueIdx - dur);
    return { task, idx, startIdx, dueIdx: dueIdx >= 0 ? dueIdx : dateBounds.days.length - 1 };
  }), [activeTasks, dateBounds]);

  const connectors = useMemo(() => items.flatMap(({ task, idx, startIdx, dueIdx }) =>
    (task.dependencies ?? []).flatMap((depId) => {
      const pre = items.find((x) => x.task.id === depId);
      if (!pre) return [];
      const x1 = (pre.dueIdx + 0.9) * DAY_W, y1 = pre.idx * ROW_H + ROW_H / 2;
      const x2 = startIdx * DAY_W, y2 = idx * ROW_H + ROW_H / 2;
      const cx = Math.max(x1 + 20, x2 - 20);
      return [{ path: `M${x1} ${y1} C${cx} ${y1},${cx} ${y2},${x2} ${y2}`, preId: depId, sucId: task.id }];
    })
  ), [items]);

  const BAR_COLORS: Record<string, string> = {
    "Done": "bg-green-500", "Review": "bg-[#EF8F00]", "In Progress": "bg-[#0038BC]", "To Do": "bg-[#A0A0A0]",
  };

  const toggleDep = async (taskId: string, depId: string) => {
    const t = activeTasks.find((x) => x.id === taskId);
    if (!t || !token) return;
    const deps = (t.dependencies ?? []).includes(depId)
      ? t.dependencies!.filter((d) => d !== depId)
      : [...(t.dependencies ?? []), depId];
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dependencies: deps }),
    });
    if (res.ok) onTaskUpdated();
  };

  const selectedTask = activeTasks.find((t) => t.id === selectedId);
  const totalW = dateBounds.days.length * DAY_W;

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
      {/* Legend */}
      <div className="px-4 py-3 border-b border-[#E8E8E8] bg-[#F7F8FA] flex flex-wrap items-center gap-4 text-xs text-[#737373]">
        <span className="flex items-center gap-1.5"><GitMerge className="w-3.5 h-3.5 text-[#0038BC]" /> Gantt Timeline</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#A0A0A0] inline-block" /> To Do</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#0038BC] inline-block" /> In Progress</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#EF8F00] inline-block" /> Review</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> Done</span>
        <span className="ml-auto text-[#A0A0A0]">{dateBounds.days[0]} → {dateBounds.days[dateBounds.days.length - 1]}</span>
      </div>

      {activeTasks.length === 0 ? (
        <div className="py-20 text-center">
          <Calendar className="w-10 h-10 text-[#D0D0D0] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#525252]">No tasks to display</p>
        </div>
      ) : (
        <div className="flex overflow-hidden">
          {/* Left labels */}
          <div className="w-52 shrink-0 border-r border-[#E8E8E8]">
            <div className="h-10 border-b border-[#E8E8E8] bg-[#F7F8FA] px-3 flex items-center text-xs font-medium text-[#737373]">
              Task
            </div>
            {items.map(({ task }) => (
              <div key={task.id}
                onClick={() => setSelectedId(task.id === selectedId ? null : task.id)}
                className={`h-12 px-3 flex flex-col justify-center border-b border-[#E8E8E8] cursor-pointer transition-colors ${selectedId === task.id ? "bg-[#e8edfb]" : "hover:bg-[#F7F8FA]"}`}>
                <button onClick={(e) => { e.stopPropagation(); navigate(`tasks/${task.id}`); }}
                  className="text-xs font-medium text-[#111111] hover:text-[#0038BC] hover:underline text-left truncate">
                  {task.title}
                </button>
                <span className="text-xs text-[#A0A0A0]">Due: {task.dueDate}</span>
              </div>
            ))}
          </div>

          {/* Right timeline */}
          <div className="flex-1 overflow-x-auto">
            {/* Day headers */}
            <div className="flex h-10 border-b border-[#E8E8E8] bg-[#F7F8FA] sticky top-0" style={{ width: totalW }}>
              {dateBounds.days.map((d) => {
                const dt = new Date(d);
                const isWe = dt.getDay() === 0 || dt.getDay() === 6;
                return (
                  <div key={d} style={{ width: DAY_W }}
                    className={`shrink-0 flex flex-col items-center justify-center text-xs border-r border-[#E8E8E8] ${isWe ? "bg-[#EEEEEE] text-[#A0A0A0]" : "text-[#525252]"}`}>
                    <span className="font-medium">{dt.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            <div className="relative" style={{ width: totalW, height: items.length * ROW_H }}>
              {/* Grid */}
              <div className="absolute inset-0 flex pointer-events-none">
                {dateBounds.days.map((d) => {
                  const dt = new Date(d);
                  return <div key={d} style={{ width: DAY_W }} className={`shrink-0 h-full border-r border-[#E8E8E8] ${(dt.getDay() === 0 || dt.getDay() === 6) ? "bg-[#EEEEEE]/40" : ""}`} />;
                })}
              </div>

              {/* SVG connectors */}
              <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: totalW, height: items.length * ROW_H }}>
                <defs>
                  <marker id="arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0 1L8 4L0 7z" fill="#A0A0A0" />
                  </marker>
                </defs>
                {connectors.map(({ path, preId, sucId }, i) => {
                  const hi = hoveredId === preId || hoveredId === sucId;
                  return (
                    <path key={i} d={path} fill="none"
                      stroke={hi ? "#0038BC" : "#C0C0C0"}
                      strokeWidth={hi ? 2 : 1.5}
                      strokeDasharray={hi ? "0" : "4 2"}
                      markerEnd="url(#arr)" />
                  );
                })}
              </svg>

              {/* Bars */}
              {items.map(({ task, idx, startIdx, dueIdx }) => {
                const left = startIdx * DAY_W + 4;
                const width = Math.max(DAY_W, (dueIdx - startIdx + 1) * DAY_W - 8);
                const isHov = hoveredId === task.id;
                const isSel = selectedId === task.id;
                return (
                  <div key={task.id} className="absolute flex items-center"
                    style={{ top: idx * ROW_H, height: ROW_H, left: 0, width: totalW }}>
                    <div
                      onMouseEnter={() => setHoveredId(task.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => setSelectedId(task.id === selectedId ? null : task.id)}
                      className={`absolute h-7 rounded-md flex items-center px-2 cursor-pointer transition-all text-white text-xs font-medium truncate ${BAR_COLORS[task.status]} ${isHov ? "brightness-110 shadow-md" : ""} ${isSel ? "ring-2 ring-offset-1 ring-[#0038BC]" : ""}`}
                      style={{ left, width }}>
                      {task.dependencies && task.dependencies.length > 0 && <GitMerge className="w-3 h-3 mr-1 shrink-0 opacity-80" />}
                      {task.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dependency editor panel */}
      {selectedId && selectedTask && (
        <div className="border-t border-[#E8E8E8] p-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F7F8FA]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#0038BC]" />
                <span className="text-sm font-semibold text-[#111111]">Dependencies for "{selectedTask.title}"</span>
              </div>
              <button onClick={() => setSelectedId(null)} className="p-1 text-[#737373] hover:text-[#111111]"><X className="w-4 h-4" /></button>
            </div>
            {(selectedTask.dependencies ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {selectedTask.dependencies!.map((depId) => {
                  const d = activeTasks.find((t) => t.id === depId);
                  if (!d) return null;
                  return (
                    <div key={depId} className="flex items-center justify-between p-2 bg-white border border-[#E8E8E8] rounded-lg text-sm">
                      <span className="font-medium text-[#111111] truncate">{d.title}</span>
                      <button onClick={() => toggleDep(selectedTask.id, depId)} className="text-xs text-red-600 hover:underline ml-2 shrink-0">Remove</button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-[#A0A0A0]">No dependencies set.</p>}
          </div>

          <div>
            <p className="text-sm font-semibold text-[#111111] mb-2">Add dependency</p>
            <select onChange={(e) => { if (e.target.value) { toggleDep(selectedTask.id, e.target.value); e.target.value = ""; } }}
              className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]" defaultValue="">
              <option value="">Select prerequisite task…</option>
              {activeTasks.filter((t) => t.id !== selectedTask.id && !(selectedTask.dependencies ?? []).includes(t.id))
                .map((t) => <option key={t.id} value={t.id}>[{t.category}] {t.title} ({t.status})</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
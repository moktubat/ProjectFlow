import React, { useRef } from "react";
import { Task, User } from "../../types/index.js";
import { useUIStore } from "../../store/ui-store.js";
import { Clock, Calendar, GitMerge } from "lucide-react";

interface KanbanCardProps {
  task: Task;
  users: User[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-[#F4F4F4] text-[#737373]",
  Medium: "bg-[#fef3dc] text-[#9a5b00]",
  High: "bg-orange-50 text-orange-700",
  Critical: "bg-red-50 text-red-700",
};

const CATEGORY_STYLES: Record<string, string> = {
  Development: "bg-emerald-50 text-emerald-700",
  Design: "bg-purple-50 text-purple-700",
  QA: "bg-cyan-50 text-cyan-700",
  Management: "bg-indigo-50 text-indigo-700",
  Billing: "bg-amber-50 text-amber-700",
  Others: "bg-[#F4F4F4] text-[#737373]",
};

export function KanbanCard({ task, users, onDragStart, onDragEnd }: KanbanCardProps) {
  const isDragging = useRef(false);
  const navigate = useUIStore((s) => s.navigate);
  const logged = task.timeLogs.reduce((s, l) => s + l.hours, 0);

  const getUserInitial = (id: string) => users.find((u) => u.id === id)?.name.charAt(0).toUpperCase() ?? "?";
  const getUserName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  const handleDragStart = (e: React.DragEvent) => {
    isDragging.current = true;
    onDragStart(e, task.id);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    onDragEnd(e);
    setTimeout(() => { isDragging.current = false; }, 100);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => { if (!isDragging.current) navigate(`tasks/${task.id}`); }}
      className="bg-white border border-[#E8E8E8] rounded-lg p-3.5 cursor-grab active:cursor-grabbing hover:border-[#0038BC]/30 hover:shadow-sm transition-all group"
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${CATEGORY_STYLES[task.category] ?? CATEGORY_STYLES.Others}`}>
          {task.category}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.Low}`}>
          {task.priority}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-[#111111] leading-snug mb-2.5 group-hover:text-[#0038BC] transition-colors">
        {task.title}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-[#737373] mb-3">
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{task.dueDate}</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{logged}h / {task.estimatedHours}h</span>
        {task.dependencies && task.dependencies.length > 0 && (
          <span className="flex items-center gap-1 text-[#EF8F00]">
            <GitMerge className="w-3 h-3" />{task.dependencies.length}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#E8E8E8]">
        <div className="flex -space-x-1.5">
          {task.assignees.length > 0 ? task.assignees.map((a, i) => (
            a.userId ? (
              <div key={i} title={getUserName(a.userId)}
                className="w-6 h-6 rounded-full bg-[#e8edfb] border-2 border-white text-[#0038BC] text-xs font-medium flex items-center justify-center">
                {getUserInitial(a.userId)}
              </div>
            ) : (
              <div key={i} title="Team"
                className="w-6 h-6 rounded-full bg-[#fef3dc] border-2 border-white text-[#EF8F00] text-xs font-medium flex items-center justify-center">
                T
              </div>
            )
          )) : <span className="text-xs text-[#A0A0A0]">Unassigned</span>}
        </div>
        {task.projectName && (
          <span className="text-xs text-[#A0A0A0] truncate max-w-[100px]">{task.projectName}</span>
        )}
      </div>
    </div>
  );
}
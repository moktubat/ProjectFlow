import React, { useState } from "react";
import { Task, User } from "../../types/index.js";
import { KanbanCard } from "./KanbanCard.js";

interface KanbanColumnProps {
  status: Task["status"];
  tasks: Task[];
  users: User[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: Task["status"]) => void;
}

const COLUMN_STYLES: Record<string, { dot: string; header: string }> = {
  "To Do": { dot: "bg-[#A0A0A0]", header: "text-[#525252]" },
  "In Progress": { dot: "bg-[#0038BC]", header: "text-[#0038BC]" },
  "Review": { dot: "bg-[#EF8F00]", header: "text-[#9a5b00]" },
  "Done": { dot: "bg-green-500", header: "text-green-700" },
};

export function KanbanColumn({ status, tasks, users, onDragStart, onDragEnd, onDrop }: KanbanColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const style = COLUMN_STYLES[status];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => { setIsOver(false); onDrop(e, status); }}
      className={`flex-1 min-w-[240px] rounded-xl border-2 p-3 flex flex-col min-h-[480px] transition-colors ${isOver ? "border-[#0038BC] bg-[#e8edfb]/30" : "border-[#E8E8E8] bg-[#F7F8FA]"
        }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          <span className={`text-sm font-semibold ${style.header}`}>{status}</span>
        </div>
        <span className="text-xs text-[#737373] bg-[#EEEEEE] px-2 py-0.5 rounded-full font-medium">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[65vh] pr-0.5">
        {tasks.map((t) => (
          <KanbanCard key={t.id} task={t} users={users} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        ))}
        {tasks.length === 0 && (
          <div className="h-32 border-2 border-dashed border-[#D0D0D0] rounded-lg flex items-center justify-center">
            <span className="text-xs text-[#A0A0A0]">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}
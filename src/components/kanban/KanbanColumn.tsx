/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, User } from "../../types/index.js";
import { KanbanCard } from "./KanbanCard.js";

interface KanbanColumnProps {
  status: Task["status"];
  tasks: Task[];
  users: User[];
  isAnyDragging: boolean;
}

const COLUMN_STYLES: Record<string, { dot: string; header: string; dropBg: string }> = {
  "To Do":       { dot: "bg-[#A0A0A0]", header: "text-[#525252]",  dropBg: "bg-[#F4F4F4]/60" },
  "In Progress": { dot: "bg-[#0038BC]", header: "text-[#0038BC]",  dropBg: "bg-[#e8edfb]/40" },
  "Review":      { dot: "bg-[#EF8F00]", header: "text-[#9a5b00]",  dropBg: "bg-[#fef3dc]/40" },
  "Done":        { dot: "bg-green-500", header: "text-green-700",   dropBg: "bg-green-50/40"  },
};

export function KanbanColumn({ status, tasks, users, isAnyDragging }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = COLUMN_STYLES[status];

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 min-w-[240px] rounded-xl border-2 p-3 flex flex-col min-h-[480px]
        transition-colors duration-150
        ${isOver
          ? `border-[#0038BC] ${style.dropBg}`
          : isAnyDragging
          ? "border-dashed border-[#D0D0D0] bg-[#F7F8FA]"
          : "border-[#E8E8E8] bg-[#F7F8FA]"
        }
      `}
    >
      {/* Column header */}
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
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[65vh] pr-0.5">
          {tasks.map((t) => (
            <KanbanCard key={t.id} task={t} users={users} />
          ))}

          {tasks.length === 0 && (
            <div
              className={`
                h-32 border-2 border-dashed rounded-lg flex items-center justify-center
                transition-colors duration-150
                ${isOver ? "border-[#0038BC] bg-[#e8edfb]/20" : "border-[#D0D0D0]"}
              `}
            >
              <span className="text-xs text-[#A0A0A0]">
                {isOver ? "Release to drop here" : "Drop here"}
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
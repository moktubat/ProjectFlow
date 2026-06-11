/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Task, User } from "../../types/index.js";
import { KanbanCard } from "./KanbanCard.js";
import { gsap } from "gsap";

interface KanbanColumnProps {
  status: "To Do" | "In Progress" | "Review" | "Done";
  tasks: Task[];
  users: User[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: "To Do" | "In Progress" | "Review" | "Done") => void;
  key?: React.Key;
}

export function KanbanColumn({ status, tasks, users, onDragStart, onDragEnd, onDrop }: KanbanColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);

  // Status-colored indicators
  const getHeaderColors = () => {
    switch (status) {
      case "To Do":
        return { text: "text-slate-700 bg-slate-100", dot: "bg-slate-500" };
      case "In Progress":
        return { text: "text-sky-700 bg-sky-50 border-sky-100", dot: "bg-sky-500" };
      case "Review":
        return { text: "text-theme-yellow bg-amber-50 border-amber-100", dot: "bg-theme-yellow" };
      case "Done":
        return { text: "text-emerald-700 bg-emerald-50 border-emerald-100", dot: "bg-emerald-500" };
    }
  };

  const headerColors = getHeaderColors();

  // GSAP animations for hot drop zone highlights
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required for drop to function!
    if (columnRef.current) {
      gsap.to(columnRef.current, {
        backgroundColor: "#f1f5f9", // light gray highlight
        scale: 1.01,
        borderColor: "#cbd5e1",
        duration: 0.15
      });
    }
  };

  const handleDragLeave = () => {
    if (columnRef.current) {
      gsap.to(columnRef.current, {
        backgroundColor: "#f8fafc", // slate-50
        scale: 1,
        borderColor: "#f1f5f9",
        duration: 0.2
      });
    }
  };

  const handleLocalDrop = (e: React.DragEvent) => {
    if (columnRef.current) {
      gsap.to(columnRef.current, {
        backgroundColor: "#f8fafc",
        scale: 1,
        borderColor: "#f1f5f9",
        duration: 0.2
      });
      // Delightful column drop bounce
      gsap.fromTo(columnRef.current, { y: 2 }, { y: 0, ease: "bounce.out", duration: 0.35 });
    }
    onDrop(e, status);
  };

  return (
    <div
      ref={columnRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleLocalDrop}
      className="flex-1 bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col min-h-[480px] transition-all"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-200/40">
        <div className="flex items-center space-x-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${headerColors.dot}`} />
          <h3 className="text-sm font-bold tracking-tight text-slate-800 font-display">
            {status}
          </h3>
          <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full font-mono">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Task List container */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 max-h-[70vh]">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            users={users}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}

        {tasks.length === 0 && (
          <div className="h-44 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-4">
            <span className="text-xs text-slate-400 font-medium">Empty Lane</span>
            <span className="text-[10px] text-slate-400 italic">Drag items here</span>
          </div>
        )}
      </div>
    </div>
  );
}

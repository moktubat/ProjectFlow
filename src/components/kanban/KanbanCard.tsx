/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Task, User } from "../../types/index.js";
import { useUIStore } from "../../store/ui-store.js";
import { Clock, Calendar, AlertTriangle, MessageSquare, GitMerge } from "lucide-react";
import { gsap } from "gsap";

interface KanbanCardProps {
  task: Task;
  users: User[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  key?: React.Key;
}

export function KanbanCard({ task, users, onDragStart, onDragEnd }: KanbanCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const navigate = useUIStore((state) => state.navigate);

  const totalLoggedHours = task.timeLogs.reduce((sum, log) => sum + log.hours, 0);

  // GSAP animations for active dragging feel
  const handleLocalDragStart = (e: React.DragEvent) => {
    isDraggingRef.current = true;
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        scale: 1.05,
        rotate: 1.5,
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        duration: 0.15
      });
    }
    onDragStart(e, task.id);
  };

  const handleLocalDragEnd = (e: React.DragEvent) => {
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        scale: 1,
        rotate: 0,
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        duration: 0.2
      });
    }
    onDragEnd(e);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  // Get user initials for display
  const getAssigneeInitials = (userId: string) => {
    const u = users.find((x) => x.id === userId);
    return u ? u.name.charAt(0).toUpperCase() : "?";
  };

  const getAssigneeName = (userId: string) => {
    const u = users.find((x) => x.id === userId);
    return u ? u.name : "Assigned User";
  };

  // Priority color stamps
  const getPriorityBadge = (p: string) => {
    const colors = {
      Low: "bg-slate-100 text-slate-700",
      Medium: "bg-theme-yellow/10 text-theme-yellow",
      High: "bg-orange-100 text-orange-700",
      Critical: "bg-theme-pink/10 text-theme-pink font-semibold border border-theme-pink/20"
    };
    return colors[p as keyof typeof colors] || "bg-slate-100 text-slate-700";
  };

  // Category visual labels
  const getCategoryBadge = (c: string) => {
    const colors = {
      Development: "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
      Design: "bg-purple-50 text-purple-700 border border-purple-200/50",
      QA: "bg-cyan-50 text-cyan-700 border border-cyan-200/50",
      Management: "bg-indigo-50 text-indigo-700 border border-indigo-200/50",
      Billing: "bg-amber-50 text-amber-700 border border-amber-200/50",
      Others: "bg-slate-100 text-slate-700"
    };
    return colors[c as keyof typeof colors] || "bg-slate-100 text-slate-700";
  };

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleLocalDragStart}
      onDragEnd={handleLocalDragEnd}
      onClick={() => {
        if (isDraggingRef.current) return;
        navigate(`tasks/${task.id}`);
      }}
      className="bg-white border border-slate-200 rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors shadow-xs group/card relative"
    >
      {/* Category & Priority Row */}
      <div className="flex items-center justify-between mb-3.5">
        <span className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-full ${getCategoryBadge(task.category)}`}>
          {task.category}
        </span>
        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${getPriorityBadge(task.priority)}`}>
          {task.priority}
        </span>
      </div>

      {/* Task Title */}
      <h4 className="text-sm font-semibold text-slate-800 leading-snug mb-2 group-hover/card:text-theme-teal transition-colors">
        {task.title}
      </h4>

      {/* Quick indicators */}
      <div className="flex items-center space-x-4 text-slate-500 text-[11px] mb-4 font-medium font-mono">
        {/* Due Date */}
        <div className="flex items-center space-x-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{task.dueDate}</span>
        </div>

        {/* Hour balance logs */}
        <div className="flex items-center space-x-1.5" title="Logged hours vs Estimate">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{totalLoggedHours}h / {task.estimatedHours}h</span>
        </div>

        {/* Task dependencies count indicator */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="flex items-center space-x-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-sm" title={`${task.dependencies.length} prerequisite tasks block this`}>
            <GitMerge className="w-3 h-3 text-amber-500" />
            <span>{task.dependencies.length} Dep</span>
          </div>
        )}
      </div>

      {/* Assignee circles footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex -space-x-1.5 overflow-hidden">
          {task.assignees && task.assignees.length > 0 ? (
            task.assignees.map((asg, idx) => {
              if (asg.userId) {
                return (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white text-[9px] font-bold text-slate-700 flex items-center justify-center font-mono uppercase"
                    title={getAssigneeName(asg.userId)}
                  >
                    {getAssigneeInitials(asg.userId)}
                  </div>
                );
              } else if (asg.teamId) {
                return (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded-full bg-teal-100 border-2 border-white text-[8px] font-bold text-theme-teal flex items-center justify-center font-mono uppercase"
                    title={`Assigned to Team ID: ${asg.teamId}`}
                  >
                    T
                  </div>
                );
              }
              return null;
            })
          ) : (
            <span className="text-[10px] text-slate-400 font-medium italic">Unassigned</span>
          )}
        </div>

        <span className="text-[10px] text-slate-400 font-mono tracking-wide bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
          {task.projectName}
        </span>
      </div>
    </div>
  );
}

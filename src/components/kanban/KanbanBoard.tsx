/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { Task, User } from "../../types/index.js";
import { KanbanColumn } from "./KanbanColumn.js";
import { KanbanCard } from "./KanbanCard.js";
import { useUIStore } from "../../store/ui-store.js";
import { useDragDropBoard, BOARD_STATUSES } from "../../hooks/useDragDropBoard.js";

interface KanbanBoardProps {
  tasks: Task[];
  users: User[];
  onTaskUpdated: (taskId?: string, newStatus?: string) => void;
}

export function KanbanBoard({ tasks, users, onTaskUpdated }: KanbanBoardProps) {
  const token = useUIStore((s) => s.token);
  const {
    localTasks,
    activeTask,
    errorMsg,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    handleNativeDragOver,
    handleNativeDrop,
  } = useDragDropBoard(tasks, token, onTaskUpdated);

  return (
    <div
      className="space-y-3"
      onDragOver={handleNativeDragOver}
      onDrop={handleNativeDrop}
    >
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {errorMsg}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-2">
          {BOARD_STATUSES.map((col) => (
            <KanbanColumn
              key={col}
              status={col}
              tasks={localTasks.filter((t) => t.status === col && !t.deleted)}
              users={users}
              isAnyDragging={!!activeTask}
            />
          ))}
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}
        >
          {activeTask ? (
            <div className="rotate-2 opacity-95 shadow-2xl">
              <KanbanCard task={activeTask} users={users} isDragOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
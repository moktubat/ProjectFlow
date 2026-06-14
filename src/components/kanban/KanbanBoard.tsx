/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { Task, User } from "../../types/index.js";
import { KanbanColumn } from "./KanbanColumn.js";
import { KanbanCard } from "./KanbanCard.js";
import { useUIStore } from "../../store/ui-store.js";

interface KanbanBoardProps {
  tasks: Task[];
  users: User[];
  onTaskUpdated: () => void;
}

const COLUMNS: Task["status"][] = ["To Do", "In Progress", "Review", "Done"];

export function KanbanBoard({ tasks, users, onTaskUpdated }: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const token = useUIStore((s) => s.token);
  const isDragging = useRef(false);

  // Sync with parent only when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setLocalTasks(tasks);
    }
  }, [tasks]);

  // Prevent the browser's native DnD from triggering navigation/reload.
  // @dnd-kit uses pointer events, but if a user has a mouse that fires
  // a stray "drop" event we want to swallow it at the board level.
  const handleNativeDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleNativeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 5px movement before drag starts — avoids accidental drags on clicks
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    isDragging.current = true;
    setErrorMsg(null);
    const task = localTasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }, [localTasks]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const overTask = localTasks.find((t) => t.id === overId);
    const overStatus = overTask
      ? overTask.status
      : COLUMNS.includes(overId as any)
      ? (overId as Task["status"])
      : null;

    if (!overStatus) return;

    setLocalTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: overStatus } : t))
    );
  }, [localTasks]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      isDragging.current = false;
      setActiveTask(null);

      const { active, over } = event;
      if (!over || !token) return;

      const activeId = active.id as string;

      // Status was already updated optimistically in handleDragOver
      const movedTask = localTasks.find((t) => t.id === activeId);
      if (!movedTask) return;

      const newStatus = movedTask.status;
      const originalTask = tasks.find((t) => t.id === activeId);
      if (!originalTask || originalTask.status === newStatus) return;

      try {
        const res = await fetch(`/api/tasks/${activeId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          const data = await res.json();
          // Roll back optimistic update
          setLocalTasks(tasks);
          setErrorMsg(data.error || "Could not move task — change rolled back.");
          setTimeout(() => setErrorMsg(null), 4000);
        } else {
          // Notify parent to refresh activity stream, stats, etc.
          // We call this WITHOUT awaiting so the board doesn't flicker.
          onTaskUpdated();
        }
      } catch {
        setLocalTasks(tasks);
        setErrorMsg("Network error — task move rolled back.");
        setTimeout(() => setErrorMsg(null), 4000);
      }
    },
    [localTasks, tasks, token, onTaskUpdated]
  );

  const handleDragCancel = useCallback(() => {
    isDragging.current = false;
    setActiveTask(null);
    setLocalTasks(tasks); // restore on cancel
  }, [tasks]);

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
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              status={col}
              tasks={localTasks.filter((t) => t.status === col && !t.deleted)}
              users={users}
              isAnyDragging={!!activeTask}
            />
          ))}
        </div>

        {/* Floating drag overlay card */}
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
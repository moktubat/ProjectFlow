import React, { useRef, useState, useCallback } from "react";
import { Task, User } from "../../types/index.js";
import { KanbanColumn } from "./KanbanColumn.js";
import { useUIStore } from "../../store/ui-store.js";

interface KanbanBoardProps {
  tasks: Task[];
  users: User[];
  onTaskUpdated: () => void;
}

export function KanbanBoard({ tasks, users, onTaskUpdated }: KanbanBoardProps) {
  // Local optimistic copy of tasks — updates instantly on drop
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [errorId, setErrorId] = useState<string | null>(null);

  // Keep localTasks in sync when parent refreshes (but not during an active drag)
  const isDraggingRef = useRef(false);
  React.useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalTasks(tasks);
    }
  }, [tasks]);

  const draggedId = useRef<string | null>(null);
  const token = useUIStore((s) => s.token);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    isDraggingRef.current = true;
    draggedId.current = id;
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setErrorId(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    draggedId.current = null;
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, status: Task["status"]) => {
      e.preventDefault();
      isDraggingRef.current = false;

      const id = draggedId.current || e.dataTransfer.getData("text/plain");
      draggedId.current = null;
      if (!id || !token) return;

      const originalTasks = localTasks;
      const taskToMove = originalTasks.find((t) => t.id === id);
      if (!taskToMove || taskToMove.status === status) return;

      // ── Optimistic update ──────────────────────────────────────────────
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t))
      );

      // ── Persist to server ──────────────────────────────────────────────
      try {
        const res = await fetch(`/api/tasks/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        });

        if (!res.ok) {
          const data = await res.json();
          // Roll back on error
          setLocalTasks(originalTasks);
          setErrorId(id);
          console.error("[Kanban] Move rejected:", data.error);
          // Show inline error briefly
          setTimeout(() => setErrorId(null), 3000);
        } else {
          // Quietly tell parent so analytics / activity stream can refresh
          // without re-rendering the board
          onTaskUpdated();
        }
      } catch (err) {
        // Network error — roll back
        setLocalTasks(originalTasks);
        setErrorId(id);
        setTimeout(() => setErrorId(null), 3000);
      }
    },
    [localTasks, token, onTaskUpdated]
  );

  const columns: Task["status"][] = ["To Do", "In Progress", "Review", "Done"];

  return (
    <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-2">
      {/* Inline error banner */}
      {errorId && (
        <div className="w-full lg:absolute lg:top-0 lg:left-0 z-50 px-4 py-2
                        bg-red-50 border border-red-200 rounded-lg text-sm text-red-700
                        flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2
                 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1
                 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Could not move task — change rolled back. Check dependencies or try again.
        </div>
      )}

      {columns.map((col) => (
        <KanbanColumn
          key={col}
          status={col}
          tasks={localTasks.filter((t) => t.status === col)}
          users={users}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Task, User } from "../../types/index.js";
import { KanbanColumn } from "./KanbanColumn.js";
import { useUIStore } from "../../store/ui-store.js";

interface KanbanBoardProps {
  tasks: Task[];
  users: User[];
  onTaskUpdated: () => void;
}

export function KanbanBoard({ tasks, users, onTaskUpdated }: KanbanBoardProps) {
  const draggedTaskIdRef = useRef<string | null>(null);
  const token = useUIStore((state) => state.token);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    draggedTaskIdRef.current = taskId;
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    draggedTaskIdRef.current = null;
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: "To Do" | "In Progress" | "Review" | "Done") => {
    e.preventDefault();
    const taskId = draggedTaskIdRef.current || e.dataTransfer.getData("text/plain");
    
    if (!taskId || !token) return;

    // Optional optimization: immediately updating local lists is possible, 
    // but the backend update is quick. Let's trigger the backend call:
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });

      if (res.ok) {
        onTaskUpdated(); // trigger refreshing task list
      } else {
        const errData = await res.json();
        console.error("Failed to move card task status:", errData.error);
        alert(`Error shifting status: ${errData.error}`);
      }
    } catch (err) {
      console.error("Error updating task drag:", err);
    } finally {
      draggedTaskIdRef.current = null;
    }
  };

  // Extract separate lanes
  const columns: ("To Do" | "In Progress" | "Review" | "Done")[] = ["To Do", "In Progress", "Review", "Done"];

  return (
    <div className="flex flex-col lg:flex-row space-y-6 lg:space-y-0 lg:space-x-5.5 overflow-x-auto select-none py-2">
      {columns.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col);
        return (
          <KanbanColumn
            key={col}
            status={col}
            tasks={columnTasks}
            users={users}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
          />
        );
      })}
    </div>
  );
}

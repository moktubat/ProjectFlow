/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { Task } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useTask(taskId?: string) {
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useUIStore((state) => state.token);

  const fetchTask = useCallback(async () => {
    if (!token || !taskId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to load task details.");
      }
      const data = await res.json();
      setTask(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [token, taskId]);

  const updateTask = async (data: Partial<Task>) => {
    if (!token || !taskId) throw new Error("Authentication required.");
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    const updated = await res.json();
    if (!res.ok) {
      throw new Error(updated.error || "Failed to update task.");
    }
    setTask(updated);
    return updated;
  };

  const logHours = async (hoursData: { hours: number; note: string; startTime?: string; endTime?: string }) => {
    if (!token || !taskId) throw new Error("Authentication required.");
    const res = await fetch(`/api/tasks/${taskId}/log-hours`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(hoursData)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to log time.");
    }
    await fetchTask();
    return data;
  };

  const deleteTask = async () => {
    if (!token || !taskId) throw new Error("Authentication required.");
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete task.");
    }
    return true;
  };

  useEffect(() => {
    if (taskId) {
      fetchTask();
    }
  }, [taskId, fetchTask]);

  return {
    task,
    isLoading,
    error,
    refresh: fetchTask,
    updateTask,
    logHours,
    deleteTask
  };
}
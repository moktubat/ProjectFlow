/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { Task } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useTasks(projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useUIStore((state) => state.token);

  const fetchTasks = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) { setIsLoading(true); setError(null); }
    try {
      const url = projectId ? `/api/tasks?projectId=${projectId}` : "/api/tasks";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const errObj = await res.json().catch(() => ({})); throw new Error(errObj.error || "Failed to load tasks."); }
      setTasks(await res.json());
    } catch (err: any) {
      if (!silent) setError(err.message || "An unexpected error occurred");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [token, projectId]);

  const createTask = async (taskData: Partial<Task>) => {
    if (!token) throw new Error("Authentication required.");
    // If hook is initialized with a specific projectId, use it; otherwise, use the one in taskData
    const payload = { ...taskData };
    if (projectId) {
      payload.projectId = projectId;
    }
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create task.");
    }
    await fetchTasks();
    return data;
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    isLoading,
    error,
    refresh: fetchTasks,
    createTask,
    setTasks
  };
}
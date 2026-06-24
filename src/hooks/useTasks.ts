import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Task } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useTasks(projectId?: string) {
  const token = useUIStore((state) => state.token);
  const queryClient = useQueryClient();

  const query = useQuery<Task[]>({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const url = projectId ? `/api/tasks?projectId=${projectId}` : "/api/tasks";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to load tasks.");
      }
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      if (!token) throw new Error("Authentication required.");
      const payload = { ...taskData };
      if (projectId) payload.projectId = projectId;

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create task.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const updateLocalTask = useCallback((updatedTask: Task) => {
    queryClient.setQueryData<Task[]>(["tasks", projectId], (old) =>
      old?.map((t) => (t.id === updatedTask.id ? updatedTask : t)) ?? []
    );
  }, [queryClient, projectId]);

  const updateTaskStatus = useCallback((taskId: string, newStatus: string) => {
    queryClient.setQueryData<Task[]>(["tasks", projectId], (old) =>
      old?.map((t) =>
        t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t
      ) ?? []
    );
  }, [queryClient, projectId]);

  const setTasks = useCallback((updater: Task[] | ((prev: Task[]) => Task[])) => {
    queryClient.setQueryData<Task[]>(["tasks", projectId], (old) => {
      if (typeof updater === "function") return updater(old ?? []);
      return updater;
    });
  }, [queryClient, projectId]);

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh: query.refetch,
    refreshSilent: query.refetch,
    updateLocalTask,
    updateTaskStatus,
    createTask: createMutation.mutateAsync,
    setTasks,
  };
}
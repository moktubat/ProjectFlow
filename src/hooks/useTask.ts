import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useTask(taskId?: string) {
  const token = useUIStore((state) => state.token);
  const queryClient = useQueryClient();

  const query = useQuery<Task>({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to load task details.");
      }
      return res.json();
    },
    enabled: !!token && !!taskId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      if (!token || !taskId) throw new Error("Authentication required.");
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      if (!res.ok) {
        throw new Error(updated.error || "Failed to update task.");
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["task", taskId], updated);
      if (updated.projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", updated.projectId] });
      }
    },
  });

  const logHoursMutation = useMutation({
    mutationFn: async (hoursData: { hours: number; note: string; startTime?: string; endTime?: string }) => {
      if (!token || !taskId) throw new Error("Authentication required.");
      const res = await fetch(`/api/tasks/${taskId}/log-hours`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(hoursData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log time.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (!token || !taskId) throw new Error("Authentication required.");
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete task.");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return {
    task: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh: query.refetch,
    updateTask: updateTaskMutation.mutateAsync,
    logHours: logHoursMutation.mutateAsync,
    deleteTask: deleteTaskMutation.mutateAsync,
  };
}
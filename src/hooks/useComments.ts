import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Comment } from "../types/index.js";

export function useComments(taskId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery<Comment[]>({
    queryKey: ["comments", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/comments?taskId=${taskId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load comments.");
      }
      return res.json();
    },
    enabled: !!taskId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!taskId) throw new Error("Task ID required.");
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taskId, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add comment.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
    },
  });

  return {
    comments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh: query.refetch,
    addComment: addCommentMutation.mutateAsync,
  };
}
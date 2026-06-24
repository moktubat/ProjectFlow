import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Comment } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useComments(taskId?: string) {
  const token = useUIStore((state) => state.token);
  const queryClient = useQueryClient();

  const query = useQuery<Comment[]>({
    queryKey: ["comments", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/comments?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Failed to load comments.");
      }
      return res.json();
    },
    enabled: !!token && !!taskId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!token || !taskId) throw new Error("Authentication required.");
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
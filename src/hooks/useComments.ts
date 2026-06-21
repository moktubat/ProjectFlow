/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { Comment } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useComments(taskId?: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useUIStore((state) => state.token);

  const fetchComments = useCallback(async () => {
    if (!token || !taskId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Global fetch interceptor handles 401/403 automatically
      const res = await fetch(`/api/comments?taskId=${taskId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to load comments.");
      }
      const data = await res.json();
      setComments(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [token, taskId]);

  const addComment = async (content: string) => {
    if (!token || !taskId) throw new Error("Authentication required.");
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ taskId, content })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to add comment.");
    }
    await fetchComments();
    return data;
  };

  useEffect(() => {
    if (taskId) {
      fetchComments();
    }
  }, [taskId, fetchComments]);

  return {
    comments,
    isLoading,
    error,
    refresh: fetchComments,
    addComment
  };
}
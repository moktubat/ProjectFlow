import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project } from "../types/index.js";

export function useProject(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to load project details.");
      }
      return res.json();
    },
    enabled: !!projectId,
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: Partial<Project>) => {
      if (!projectId) throw new Error("Project ID required.");
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Failed to update project.");
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["project", projectId], updated);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Project ID required.");
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project.");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ name, url, category }: { name: string; url: string; category?: string }) => {
      if (!projectId) throw new Error("Project ID required.");
      const res = await fetch(`/api/files/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, name, url, category }),
      });
      const fileItem = await res.json();
      if (!res.ok) throw new Error(fileItem.error || "Failed to confirm file upload.");
      return fileItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });

  return {
    project: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh: query.refetch,
    updateProject: updateProjectMutation.mutateAsync,
    deleteProject: deleteProjectMutation.mutateAsync,
    uploadFile: uploadFileMutation.mutateAsync,
  };
}
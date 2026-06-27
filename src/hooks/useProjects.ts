import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project } from "../types/index.js";

export function useProjects() {
  const queryClient = useQueryClient();

  const query = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to load projects.");
      }
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (projectData: Partial<Project>) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(projectData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project.");
      return data;
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh: query.refetch,
    createProject: createMutation.mutateAsync,
  };
}
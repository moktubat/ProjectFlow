import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useProjects() {
  const token = useUIStore((state) => state.token);
  const queryClient = useQueryClient();

  const query = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to load projects.");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: async (projectData: Partial<Project>) => {
      if (!token) throw new Error("Authentication required.");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(projectData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project.");
      }
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
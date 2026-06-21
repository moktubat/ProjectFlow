/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { Project } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useUIStore((state) => state.token);

  const fetchProjects = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to load projects.");
      }
      const data = await res.json();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const createProject = async (projectData: Partial<Project>) => {
    if (!token) throw new Error("Authentication required.");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(projectData)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create project.");
    }
    await fetchProjects();
    return data;
  };

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    refresh: fetchProjects,
    createProject
  };
}
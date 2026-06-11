/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { Project, ProjectFile } from "../types/index.js";
import { useUIStore } from "../store/ui-store.js";

export function useProject(projectId?: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useUIStore((state) => state.token);

  const fetchProject = useCallback(async () => {
    if (!token || !projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || "Failed to load project details.");
      }
      const data = await res.json();
      setProject(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [token, projectId]);

  const updateProject = async (data: Partial<Project>) => {
    if (!token || !projectId) throw new Error("Authentication required.");
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    const updated = await res.json();
    if (!res.ok) {
      throw new Error(updated.error || "Failed to update project.");
    }
    setProject(updated);
    return updated;
  };

  const deleteProject = async () => {
    if (!token || !projectId) throw new Error("Authentication required.");
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete project.");
    }
    return true;
  };

  const uploadFile = async (name: string, url: string, category: string) => {
    if (!token || !projectId) throw new Error("Authentication required.");
    const res = await fetch(`/api/files/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        projectId,
        name,
        url,
        category
      })
    });
    const fileItem = await res.json();
    if (!res.ok) {
      throw new Error(fileItem.error || "Failed to confirm file upload.");
    }
    // Refresh to get updated files list
    await fetchProject();
    return fileItem;
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId, fetchProject]);

  return {
    project,
    isLoading,
    error,
    refresh: fetchProject,
    updateProject,
    deleteProject,
    uploadFile
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";
import { User, Notification } from "../types/index.js";

interface UIState {
  user: User | null;
  token: string | null;
  currentPath: string; // e.g., 'dashboard', 'projects', 'projects/proj_id', 'tasks', 'tasks/tsk_id', 'teams', 'users'
  notifications: Notification[];
  sidebarOpen: boolean;

  // Actions
  setSession: (user: User | null, token: string | null) => void;
  logout: () => void;
  setPath: (path: string) => void;
  navigate: (path: string) => void;
  setNotifications: (notifs: Notification[]) => void;
  setSidebarOpen: (open: boolean) => void;
}

// Helper to get active URL path out of hash
export function getPathFromHash(): string {
  const hash = window.location.hash || "#/dashboard";
  return hash.replace(/^#\//, "") || "dashboard";
}

export const useUIStore = create<UIState>((set) => ({
  user: (() => {
    try {
      const saved = localStorage.getItem("projectflow_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem("projectflow_token") || null,
  currentPath: getPathFromHash(),
  notifications: [],
  sidebarOpen: false,

  setSession: (user, token) => {
    if (user && token) {
      localStorage.setItem("projectflow_user", JSON.stringify(user));
      localStorage.setItem("projectflow_token", token);
    } else {
      localStorage.removeItem("projectflow_user");
      localStorage.removeItem("projectflow_token");
    }
    set({ user, token });
  },

  logout: () => {
    const alreadyLoggedOut = useUIStore.getState().token === null;
    if (alreadyLoggedOut) return;

    localStorage.removeItem("projectflow_user");
    localStorage.removeItem("projectflow_token");
    set({ user: null, token: null, currentPath: "login", notifications: [], sidebarOpen: false });
    window.location.hash = "#/login";
  },

  setPath: (path) => set({ currentPath: path }),

  navigate: (path) => {
    window.location.hash = `#/${path}`;
    set({ currentPath: path });
  },

  setNotifications: (notifications) => set({ notifications }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen })
}));

// Synchronize hash changes back to Zustand state automatically
window.addEventListener("hashchange", () => {
  const path = getPathFromHash();
  useUIStore.getState().setPath(path);
});

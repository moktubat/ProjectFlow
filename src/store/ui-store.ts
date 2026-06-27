import { create } from "zustand";
import { User, Notification } from "../types/index.js";

interface UIState {
  user: User | null;
  currentPath: string;
  notifications: Notification[];
  sidebarOpen: boolean;

  setSession: (user: User | null) => void;
  logout: () => void;
  setPath: (path: string) => void;
  navigate: (path: string) => void;
  setNotifications: (notifs: Notification[]) => void;
  setSidebarOpen: (open: boolean) => void;
}

export function getPathFromHash(): string {
  const hash = window.location.hash || "#/dashboard";
  return hash.replace(/^#\//, "") || "dashboard";
}

export const useUIStore = create<UIState>((set) => ({
  user: (() => {
    try {
      const saved = localStorage.getItem("projectflow_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })(),

  currentPath: getPathFromHash(),
  notifications: [],
  sidebarOpen: false,

  setSession: (user) => {
    if (user) {
      localStorage.setItem("projectflow_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("projectflow_user");
    }
    set({ user });
  },

  logout: () => {
    localStorage.removeItem("projectflow_user");
    set({ user: null, currentPath: "login", notifications: [], sidebarOpen: false });
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

window.addEventListener("hashchange", () => {
  const path = getPathFromHash();
  useUIStore.getState().setPath(path);
});
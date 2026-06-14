import React, { useEffect, useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Bell, Menu } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "My Tasks",
  teams: "Teams",
  users: "Access Approvals",
  notifications: "Notifications",
  trash: "Trash",
};

export function Navbar() {
  const currentPath = useUIStore((s) => s.currentPath);
  const user = useUIStore((s) => s.user);
  const navigate = useUIStore((s) => s.navigate);
  const notifications = useUIStore((s) => s.notifications);
  const setNotifications = useUIStore((s) => s.setNotifications);
  const token = useUIStore((s) => s.token);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getTitle = () => {
    const base = currentPath.split("/")[0];
    if (currentPath.startsWith("projects/")) return "Project Details";
    if (currentPath.startsWith("tasks/")) return "Task Details";
    return PAGE_TITLES[base] ?? "ProjectFlow";
  };

  return (
    <header className="h-14 border-b border-[#E8E8E8] bg-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 text-[#737373] hover:bg-[#F4F4F4] hover:text-[#111111] rounded-lg lg:hidden transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-[#111111]">{getTitle()}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          onClick={() => navigate("notifications")}
          className="relative p-2 text-[#737373] hover:text-[#111111] hover:bg-[#F4F4F4] rounded-lg transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF8F00] rounded-full border-2 border-white" aria-hidden="true" />
          )}
        </button>

        {/* User avatar */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-[#E8E8E8]">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-[#111111] leading-tight">{user.name}</div>
              <div className="text-xs text-[#737373]">{user.role}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#0038BC] text-white flex items-center justify-center font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
import React, { useEffect, useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Bell, Clock, LogOut, CheckCircle2, Menu } from "lucide-react";

export function Navbar() {
  const currentPath = useUIStore((state) => state.currentPath);
  const user = useUIStore((state) => state.user);
  const navigate = useUIStore((state) => state.navigate);
  const notifications = useUIStore((state) => state.notifications);
  const setNotifications = useUIStore((state) => state.setNotifications);
  const token = useUIStore((state) => state.token);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  const [time, setTime] = useState(new Date().toUTCString());

  // Periodically refresh notifications
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.warn("Could not fetch user notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      setTime(new Date().toUTCString());
      fetchNotifications();
    }, 15000); // 15 seconds poll for notifications and time
    return () => clearInterval(interval);
  }, [token]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Title generator
  const getPageTitle = () => {
    if (currentPath === "dashboard") return "Operations Control";
    if (currentPath === "projects") return "Projects Portfolio";
    if (currentPath.startsWith("projects/")) return "Project Workspace";
    if (currentPath === "tasks") return "Tasks Management";
    if (currentPath.startsWith("tasks/")) return "Task Analyzer";
    if (currentPath === "teams") return "Teams & Ranks";
    if (currentPath === "users") return "Access Approval Control";
    if (currentPath === "notifications") return "Notification Center";
    return "ProjectFlow Workspace";
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20 shadow-xs">
      {/* Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 -ml-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg lg:hidden transition-colors"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 font-display">
          {getPageTitle()}
        </h1>
        {currentPath === "dashboard" && (
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold font-mono tracking-wider px-2 py-0.5 rounded-full border border-emerald-200/50 uppercase">
            Service Active
          </span>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-6">
        {/* UTC Clock */}
        <div className="hidden lg:flex items-center space-x-2 text-slate-500 font-mono text-xs bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-200/40">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time.replace("GMT", "UTC")}</span>
        </div>

        {/* Notifications Button */}
        <button
          onClick={() => navigate("notifications")}
          className="relative p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors border border-slate-200/20"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-theme-pink rounded-full border border-white" />
          )}
        </button>

        {/* Short Profile */}
        {user && (
          <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-700 leading-tight">
                {user.name}
              </div>
              <div className="text-[9px] font-mono tracking-wide text-slate-400 uppercase">
                {user.role}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shadow-xs">
              {user.name.charAt(0)}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

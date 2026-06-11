import React from "react";
import { useUIStore } from "../../store/ui-store.js";
import { 
  LayoutDashboard, 
  FolderKanban, 
  CheckSquare, 
  Users, 
  Bell, 
  LogOut, 
  UserCheck, 
  Briefcase,
  Trash2,
  X
} from "lucide-react";

export function Sidebar() {
  const currentPath = useUIStore((state) => state.currentPath);
  const navigate = useUIStore((state) => state.navigate);
  const user = useUIStore((state) => state.user);
  const logout = useUIStore((state) => state.logout);
  const notifications = useUIStore((state) => state.notifications);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Active state checker
  const isActive = (path: string) => {
    if (path === "dashboard" && currentPath === "dashboard") return true;
    if (path === "projects" && currentPath.startsWith("projects")) return true;
    if (path === "tasks" && currentPath.startsWith("tasks")) return true;
    if (path === "teams" && currentPath === "teams") return true;
    if (path === "users" && currentPath === "users") return true;
    if (path === "notifications" && currentPath === "notifications") return true;
    if (path === "trash" && currentPath === "trash") return true;
    return false;
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "tasks", label: "My Tasks", icon: CheckSquare },
    { id: "teams", label: "Teams", icon: Users },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { id: "trash", label: "Trash Bin", icon: Trash2 },
  ];

  // Only SUPER_ADMIN or ADMIN can access/approve member registration requests
  const canApprove = user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN");

  const handleNavigate = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <aside className={`w-64 bg-theme-black text-white flex flex-col justify-between h-screen fixed top-0 left-0 z-40 border-r border-slate-800/60 shadow-lg font-sans transition-transform duration-300 lg:translate-x-0 ${
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    }`}>
      <div className="p-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => handleNavigate("dashboard")}>
            <div className="p-2.5 bg-theme-blue rounded-xl text-white shadow-neo-sm transform duration-200 group-hover:scale-105">
              <Briefcase className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-theme-blue to-theme-green bg-clip-text text-transparent uppercase">
                ProjectFlow
              </span>
              <div className="text-[9px] text-slate-400 font-mono tracking-wider font-semibold uppercase">Workspace PM</div>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded-lg lg:hidden transition-colors"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User profile capsule */}
        {user && (
          <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800/80 mb-6 flex items-center space-x-3.5">
            <div className="w-10 h-10 bg-gradient-to-tr from-theme-blue to-theme-green rounded-lg flex items-center justify-center text-slate-950 font-bold shadow">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold truncate text-slate-100">{user.name}</div>
              <div className="text-[9px] font-mono uppercase text-theme-green font-bold tracking-wider">
                {user.role}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Section */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group relative ${
                  active
                    ? "bg-theme-green text-slate-950 shadow-sm font-bold"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-105 duration-200 ${active ? "text-slate-950" : "text-slate-400 group-hover:text-white"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 text-[9px] font-bold leading-none rounded-full ${active ? "bg-theme-blue text-white" : "bg-theme-blue text-white"}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {canApprove && (
            <button
              onClick={() => handleNavigate("users")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group relative ${
                isActive("users")
                  ? "bg-theme-green text-slate-950 shadow-sm font-bold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-3">
                <UserCheck className={`w-4 h-4 ${isActive("users") ? "text-slate-950" : "text-slate-400 group-hover:text-white"}`} />
                <span>Access Approvals</span>
              </div>
            </button>
          )}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-800/60">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-white transition-all duration-155"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-white" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

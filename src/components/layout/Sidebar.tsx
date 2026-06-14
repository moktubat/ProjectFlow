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
  X,
} from "lucide-react";

export function Sidebar() {
  const currentPath = useUIStore((s) => s.currentPath);
  const navigate = useUIStore((s) => s.navigate);
  const user = useUIStore((s) => s.user);
  const logout = useUIStore((s) => s.logout);
  const notifications = useUIStore((s) => s.notifications);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
    { id: "trash", label: "Trash", icon: Trash2 },
  ];

  const canApprove =
    user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN");

  const handleNavigate = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <aside
      className={`w-60 bg-[#0D1F4E] text-white flex flex-col h-screen fixed top-0 left-0 z-40 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
    >
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleNavigate("dashboard")}
            className="flex items-center gap-2.5 group"
            aria-label="Go to dashboard"
          >
            <div className="w-8 h-8 bg-[#EF8F00] rounded-lg flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-tight">
                ProjectFlow
              </div>
              <div className="text-xs text-white/50">Workspace</div>
            </div>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-white/50 hover:text-white rounded transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User capsule */}
      {user && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0038BC] flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {user.name}
              </div>
              <div className="text-xs text-white/50 truncate">{user.role}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${active
                  ? "bg-[#0038BC] text-white font-medium"
                  : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="bg-[#EF8F00] text-white text-xs font-medium px-1.5 py-0.5 rounded-md leading-none min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {canApprove && (
          <button
            onClick={() => handleNavigate("users")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive("users")
                ? "bg-[#0038BC] text-white font-medium"
                : "text-white/70 hover:bg-white/8 hover:text-white"
              }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            Access Approvals
          </button>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
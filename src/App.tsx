import React, { useEffect } from "react";
import { useUIStore } from "./store/ui-store.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { Navbar } from "./components/layout/Navbar.js";
import { LoginView } from "./components/views/LoginView.js";
import { RegisterView } from "./components/views/RegisterView.js";
import { DashboardView } from "./components/views/DashboardView.js";
import { ProjectsView } from "./components/views/ProjectsView.js";
import { ProjectDetailsView } from "./components/views/ProjectDetailsView.js";
import { TasksListView } from "./components/views/TasksListView.js";
import { TaskDetailsView } from "./components/views/TaskDetailsView.js";
import { TeamsView } from "./components/views/TeamsView.js";
import { UsersApprovalView } from "./components/views/UsersApprovalView.js";
import { NotificationsView } from "./components/views/NotificationsView.js";
import TrashBinView from "./components/views/TrashBinView.js";
import { ToastNotificationManager } from "./components/layout/ToastNotificationManager.js";

export default function App() {
  const token = useUIStore((s) => s.token);
  const currentPath = useUIStore((s) => s.currentPath);
  const setSession = useUIStore((s) => s.setSession);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  useEffect(() => {
    const saved = localStorage.getItem("pf_session_token");
    if (saved) {
      fetch("/api/auth/session", { headers: { Authorization: `Bearer ${saved}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setSession(d.user, saved))
        .catch(() => localStorage.removeItem("pf_session_token"));
    }
  }, []);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent, false);
    window.addEventListener("drop", prevent, false);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  if (!token) {
    return currentPath === "register" ? <RegisterView /> : <LoginView />;
  }

  const renderView = () => {
    switch (currentPath) {
      case "dashboard": return <DashboardView />;
      case "projects": return <ProjectsView />;
      case "tasks": return <TasksListView />;
      case "teams": return <TeamsView />;
      case "users": return <UsersApprovalView />;
      case "notifications": return <NotificationsView />;
      case "trash": return <TrashBinView />;
      default: {
        const proj = currentPath.match(/^projects\/(.+)$/);
        if (proj) return <ProjectDetailsView projectId={proj[1]} />;
        const task = currentPath.match(/^tasks\/(.+)$/);
        if (task) return <TaskDetailsView taskId={task[1]} />;
        return <DashboardView />;
      }
    }
  };

  return (
    <div className="flex h-screen bg-[#F7F8FA] font-sans overflow-hidden antialiased">
      <Sidebar />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:pl-60">
        <Navbar />
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-16 focus:outline-none">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
      <ToastNotificationManager />
    </div>
  );
}
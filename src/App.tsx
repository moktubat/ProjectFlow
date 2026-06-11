/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  const token = useUIStore((state) => state.token);
  const currentPath = useUIStore((state) => state.currentPath);
  const setSession = useUIStore((state) => state.setSession);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  // Auto restore sessions on initial frame boots
  useEffect(() => {
    const savedToken = localStorage.getItem("pf_session_token");
    if (savedToken) {
      fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Invalid stored credentials");
        })
        .then((data) => {
          setSession(data.user, savedToken);
        })
        .catch(() => {
          localStorage.removeItem("pf_session_token");
        });
    }
  }, []);

  // Prevent browser default routing or reloads when items are dropped on the window
  useEffect(() => {
    const preventDefaultDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventDefaultDrop, false);
    window.addEventListener("drop", preventDefaultDrop, false);
    return () => {
      window.removeEventListener("dragover", preventDefaultDrop);
      window.removeEventListener("drop", preventDefaultDrop);
    };
  }, []);

  // Unauthenticated viewport route controls
  if (!token) {
    if (currentPath === "register") {
      return <RegisterView />;
    }
    return <LoginView />;
  }

  // Router resolution engine
  const renderView = () => {
    switch (currentPath) {
      case "dashboard":
        return <DashboardView />;
      case "projects":
        return <ProjectsView />;
      case "tasks":
        return <TasksListView />;
      case "teams":
        return <TeamsView />;
      case "users":
        return <UsersApprovalView />;
      case "notifications":
        return <NotificationsView />;
      case "trash":
        return <TrashBinView />;
      default:
        // Match project details with ID
        const matchProj = currentPath.match(/^projects\/(.+)$/);
        if (matchProj) {
          return <ProjectDetailsView projectId={matchProj[1]} />;
        }

        // Match task details with ID
        const matchTask = currentPath.match(/^tasks\/(.+)$/);
        if (matchTask) {
          return <TaskDetailsView taskId={matchTask[1]} />;
        }

        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden antialiased">
      {/* Visual Workspace Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Primary Workstation layout frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative lg:pl-64">
        <Navbar />

        {/* Dynamic content scroll wrapper */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-20 focus:outline-none">
          <div className="container mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
      <ToastNotificationManager />
    </div>
  );
}

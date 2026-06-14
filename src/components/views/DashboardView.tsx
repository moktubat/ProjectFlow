/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { Button } from "../ui/Button.js";
import { Task, Project, User, Role, UserStatus } from "../../types/index.js";
import {
  FolderKanban, CheckSquare, Clock, AlertCircle,
  Calendar, Users, ArrowRight, TrendingUp
} from "lucide-react";

function StatCard({
  label, value, sub, icon: Icon, accent = false,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-[#737373]">{label}</p>
        <div className={`p-2 rounded-lg ${accent ? "bg-[#fef3dc]" : "bg-[#e8edfb]"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-[#EF8F00]" : "text-[#0038BC]"}`} aria-hidden="true" />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#111111]">{value}</p>
      {sub && <p className="text-xs text-[#A0A0A0] mt-1">{sub}</p>}
    </div>
  );
}

export function DashboardView() {
  usePageTitle("Dashboard", "Your ProjectFlow workspace overview — projects, tasks, deadlines, and team workload at a glance.");

  const token = useUIStore((s) => s.token);
  const user = useUIStore((s) => s.user);
  const navigate = useUIStore((s) => s.navigate);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    Promise.all([
      fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/tasks", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(([pR, tR, uR]) =>
        Promise.all([pR.ok ? pR.json() : [], tR.ok ? tR.json() : [], uR.ok ? uR.json() : []])
      )
      .then(([p, t, u]) => { setProjects(p); setTasks(t); setUsers(u); })
      .finally(() => setIsLoading(false));
  }, [token]);

  const urgent = tasks.filter((t) => t.priority === "Critical" || t.priority === "High").length;
  const totalLogged = tasks.reduce((s, t) => s + t.timeLogs.reduce((a, l) => a + l.hours, 0), 0);
  const pending = users.filter((u) => u.status === UserStatus.PENDING);
  const canApprove = user && (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || user.role === Role.PROJECT_MANAGER);

  const myTasks = tasks.filter((t) =>
    t.assignees.some((a) => a.userId === user?.id || (user?.teamId && a.teamId === user.teamId))
  );

  const upcomingDeadlines = tasks
    .filter((t) => {
      if (t.status === "Done") return false;
      const diff = (new Date(t.dueDate).getTime() - Date.now()) / 86400000;
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const workloadCounts: Record<string, number> = {};
  tasks.forEach((t) => t.assignees.forEach((a) => { if (a.userId) workloadCounts[a.userId] = (workloadCounts[a.userId] || 0) + 1; }));

  const priorityBadge: Record<string, string> = {
    Critical: "bg-red-50 text-red-700 border border-red-200",
    High: "bg-orange-50 text-orange-700 border border-orange-200",
    Medium: "bg-[#fef3dc] text-[#9a5b00] border border-[#EF8F00]/20",
    Low: "bg-[#F4F4F4] text-[#737373] border border-[#E8E8E8]",
  };

  const statusBadge: Record<string, string> = {
    Done: "bg-green-50 text-green-700",
    "In Progress": "bg-[#e8edfb] text-[#0038BC]",
    Review: "bg-[#fef3dc] text-[#9a5b00]",
    "To Do": "bg-[#F4F4F4] text-[#737373]",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#737373]">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-[#0038BC] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Welcome back, {user?.name?.split(" ")[0]}
          </h2>
          <p className="text-sm text-blue-200 mt-0.5">
            {user?.role} · Here's what's happening today
          </p>
        </div>
        <Button
          onClick={() => navigate("projects")}
          variant="outline"
          className="bg-white/10 border-white/20 text-white hover:bg-white/20 shrink-0"
        >
          View projects
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total projects" value={projects.length} sub="In your workspace" icon={FolderKanban} />
        <StatCard label="Active tasks" value={tasks.filter((t) => t.status !== "Done").length} sub="Awaiting completion" icon={CheckSquare} />
        <StatCard label="Urgent items" value={urgent} sub="High or critical priority" icon={AlertCircle} accent />
        <StatCard label="Hours logged" value={`${totalLogged}h`} sub="Across all projects" icon={Clock} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My tasks */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E8E8E8]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E8]">
            <h3 className="font-semibold text-[#111111]">My assigned tasks</h3>
            <span className="text-xs text-[#737373] bg-[#F4F4F4] px-2 py-0.5 rounded-md">{myTasks.length} tasks</span>
          </div>
          <div className="divide-y divide-[#F4F4F4] max-h-80 overflow-y-auto">
            {myTasks.length > 0 ? myTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`tasks/${t.id}`)}
                className="w-full text-left px-5 py-3.5 hover:bg-[#F7F8FA] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111111] truncate">{t.title}</p>
                    <p className="text-xs text-[#737373] mt-0.5">
                      {t.category} · Due {t.dueDate}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 ${priorityBadge[t.priority] || "bg-[#F4F4F4] text-[#737373]"}`}>
                    {t.priority}
                  </span>
                </div>
              </button>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckSquare className="w-8 h-8 text-[#D0D0D0] mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-[#525252]">All clear!</p>
                <p className="text-xs text-[#A0A0A0] mt-0.5">No tasks assigned to you right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div className="bg-white rounded-xl border border-[#E8E8E8]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E8E8E8]">
            <Calendar className="w-4 h-4 text-[#EF8F00]" aria-hidden="true" />
            <h3 className="font-semibold text-[#111111]">Due this week</h3>
          </div>
          <div className="divide-y divide-[#F4F4F4] max-h-80 overflow-y-auto">
            {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`tasks/${t.id}`)}
                className="w-full text-left px-5 py-3.5 hover:bg-[#F7F8FA] transition-colors"
              >
                <p className="text-sm font-medium text-[#111111] truncate">{t.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-[#EF8F00] font-medium">Due {t.dueDate}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusBadge[t.status] || "bg-[#F4F4F4] text-[#737373]"}`}>
                    {t.status}
                  </span>
                </div>
              </button>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="w-8 h-8 text-[#D0D0D0] mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-[#525252]">No deadlines this week</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload */}
        <div className="bg-white rounded-xl border border-[#E8E8E8]">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <h3 className="font-semibold text-[#111111]">Team workload</h3>
          </div>
          <div className="px-5 py-4 space-y-4 max-h-72 overflow-y-auto">
            {users.filter((u) => u.status === UserStatus.APPROVED).map((u) => {
              const count = workloadCounts[u.id] || 0;
              const pct = Math.min(100, Math.round((count / Math.max(1, tasks.length)) * 100));
              return (
                <div key={u.id}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-[#111111]">{u.name}</span>
                    <span className="text-[#737373]">{count} task{count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="w-full bg-[#EEEEEE] rounded-full h-1.5">
                    <div
                      className="bg-[#0038BC] h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.max(3, pct)}%` }}
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approval queue */}
        <div className="bg-white rounded-xl border border-[#E8E8E8]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E8]">
            <h3 className="font-semibold text-[#111111]">Account approvals</h3>
            {pending.length > 0 && (
              <span className="text-xs bg-[#fef3dc] text-[#9a5b00] border border-[#EF8F00]/20 px-2 py-0.5 rounded-md font-medium">
                {pending.length} pending
              </span>
            )}
          </div>
          {canApprove ? (
            <div className="divide-y divide-[#F4F4F4] max-h-72 overflow-y-auto">
              {pending.length > 0 ? pending.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111111] truncate">{u.name}</p>
                    <p className="text-xs text-[#737373] truncate">@{u.username} · {u.email}</p>
                  </div>
                  <Button onClick={() => navigate("users")} variant="outline" size="sm" className="shrink-0">
                    Review
                  </Button>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-8 h-8 text-[#D0D0D0] mb-2" aria-hidden="true" />
                  <p className="text-sm font-medium text-[#525252]">No pending requests</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <Users className="w-8 h-8 text-[#D0D0D0] mb-2" aria-hidden="true" />
              <p className="text-sm font-medium text-[#525252]">Access restricted</p>
              <p className="text-xs text-[#A0A0A0] mt-1">Only admins and project managers can approve accounts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
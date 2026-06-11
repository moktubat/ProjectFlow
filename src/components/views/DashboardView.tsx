/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Task, Project, User, Role, UserStatus } from "../../types/index.js";
import {
  FolderKanban,
  CheckSquare,
  Clock,
  UserX,
  Calendar,
  Users,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Sparkles
} from "lucide-react";

export function DashboardView() {
  const token = useUIStore((state) => state.token);
  const user = useUIStore((state) => state.user);
  const navigate = useUIStore((state) => state.navigate);

  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [tasksList, setTasksList] = useState<Task[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Execute fetches in parallel to minimize latency
      const [projRes, taskRes, userRes] = await Promise.all([
        fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/tasks", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (projRes.ok) setProjectsList(await projRes.json());
      if (taskRes.ok) setTasksList(await taskRes.json());
      if (userRes.ok) setUsersList(await userRes.json());
    } catch (err) {
      console.warn("Error running dashboard parallel data gathers", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Calculations
  const urgentTasksCount = tasksList.filter(t => t.priority === "Critical" || t.priority === "High").length;

  // Total of all logged hours in the entire system
  const totalLoggedHours = tasksList.reduce((sum, task) => {
    return sum + task.timeLogs.reduce((s, log) => s + log.hours, 0);
  }, 0);

  // Accounts requiring approvals
  const pendingApprovals = usersList.filter(u => u.status === UserStatus.PENDING);
  const canApprove = user && (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || user.role === Role.PROJECT_MANAGER);

  // Get tasks assigned specifically to the logged-in user
  const myAssignedTasks = tasksList.filter(t =>
    t.assignees.some(asg => asg.userId === user?.id || (user?.teamId && asg.teamId === user.teamId))
  );

  // Upcoming deadlines (within 7 days)
  const upcomingDeadlines = tasksList
    .filter(t => {
      if (t.status === "Done") return false;
      const due = new Date(t.dueDate).getTime();
      const now = new Date().getTime();
      const diffDays = (due - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Aggregate workload allocation: count how many tasks are assigned to each system user
  const getWorkloadRatio = () => {
    const counts: { [userId: string]: number } = {};
    tasksList.forEach(t => {
      t.assignees.forEach(asg => {
        if (asg.userId) {
          counts[asg.userId] = (counts[asg.userId] || 0) + 1;
        }
      });
    });
    return counts;
  };

  const workloadCounts = getWorkloadRatio();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
      {/* Quick Greeting */}
      <div className="bg-brand-gradient p-7 rounded-3xl border-2 border-theme-black text-slate-900 shadow-neo flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
        {/* Visual stars */}
        <div className="absolute right-10 top-0 opacity-15">
          <Sparkles className="w-48 h-48 text-theme-blue" />
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-black tracking-tight uppercase text-slate-950">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-slate-900 text-xs mt-1.5 font-bold font-mono tracking-wider uppercase">
            Workspace Permission: <span className="bg-theme-black text-theme-green px-2 py-0.5 rounded-md text-[10px] font-black">{user?.role}</span>
          </p>
        </div>
        <div className="mt-4 md:mt-0 relative z-10">
          <Button onClick={() => navigate("projects")} variant="secondary" size="sm" className="inline-flex items-center space-x-1.5 uppercase font-bold tracking-wider">
            <span>Explore Projects</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-blue mx-auto mb-2" />
          <span className="text-xs text-slate-500 font-bold font-mono">Loading operations dataset...</span>
        </div>
      ) : (
        <>
          {/* Main Stat KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border-2 border-theme-black p-5 rounded-3xl shadow-neo-sm hover:-translate-y-1 transition-all duration-155">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Company Projects</span>
                <div className="p-2 bg-slate-100 border border-theme-black rounded-xl">
                  <FolderKanban className="w-4 h-4 text-theme-blue" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-950 tracking-tight font-sans">{projectsList.length}</p>
              <div className="mt-2 text-[10px] font-bold text-slate-400 font-mono uppercase">System Portfolio Projects</div>
            </div>

            <div className="bg-white border-2 border-theme-black p-5 rounded-3xl shadow-neo-sm hover:-translate-y-1 transition-all duration-155">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Pending Tasks</span>
                <div className="p-2 bg-slate-100 border border-theme-black rounded-xl">
                  <CheckSquare className="w-4 h-4 text-theme-blue" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-950 tracking-tight font-sans">
                {tasksList.filter(t => t.status !== "Done").length}
              </p>
              <div className="mt-2 text-[10px] font-bold text-slate-400 font-mono uppercase">Active Task Sheets</div>
            </div>

            <div className="bg-white border-2 border-theme-black p-5 rounded-3xl shadow-neo-sm hover:-translate-y-1 transition-all duration-155">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Critical Items</span>
                <div className="p-2 bg-red-100 border-2 border-red-500 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-600 animate-pulse" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-950 tracking-tight font-sans">{urgentTasksCount}</p>
              <div className="mt-2 text-[10px] font-bold text-red-500 font-mono uppercase">Immediate Attention</div>
            </div>

            <div className="bg-white border-2 border-theme-black p-5 rounded-3xl shadow-neo-sm hover:-translate-y-1 transition-all duration-155">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Logged Hours</span>
                <div className="p-2 bg-slate-100 border border-theme-black rounded-xl">
                  <Clock className="w-4 h-4 text-theme-blue" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-950 tracking-tight font-sans">{totalLoggedHours} h</p>
              <div className="mt-2 text-[10px] font-bold text-slate-400 font-mono uppercase">Across Portfolios</div>
            </div>
          </div>

          {/* Core Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* My Active Assigned Tasks list */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border-2 border-theme-black rounded-3xl p-6 shadow-neo-sm flex flex-col h-full">
                <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-slate-100">
                  <h3 className="text-xs font-black tracking-widest text-slate-950 uppercase">
                    My Tasks Inbox ({myAssignedTasks.length})
                  </h3>
                  <span className="text-[10px] bg-theme-green border border-theme-black text-slate-950 px-2 py-0.5 rounded font-mono font-bold uppercase">Assignee</span>
                </div>

                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[360px] pr-1 space-y-2">
                  {myAssignedTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => navigate(`tasks/${t.id}`)}
                      className="py-3 px-3 hover:bg-theme-cream/40 rounded-2xl border-2 border-transparent hover:border-theme-black transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-theme-blue px-2 py-0.5 bg-slate-100 rounded-md border border-slate-300">
                          {t.category}
                        </span>
                        <h4 className="text-sm font-bold text-slate-950 leading-snug truncate max-w-md mt-1">{t.title}</h4>
                        <div className="text-[10px] text-slate-500 font-mono font-medium">Due date: {t.dueDate} | State: {t.status}</div>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${t.priority === "Critical" ? "bg-red-50 text-red-600 border-red-300" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                        {t.priority}
                      </span>
                    </div>
                  ))}

                  {myAssignedTasks.length === 0 && (
                    <div className="py-16 text-center">
                      <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-bold">Clear Inbox!</p>
                      <p className="text-[10px] text-slate-400 italic mt-0.5 font-medium">You don't have any pending tasks assigned currently.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming Deadlines Widget */}
            <div className="space-y-6">
              <div className="bg-white border-2 border-theme-black rounded-3xl p-6 shadow-neo-sm flex flex-col h-full bg-linear-to-b from-white to-slate-50/50">
                <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-slate-100">
                  <h3 className="text-xs font-black tracking-widest text-slate-950 uppercase flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-theme-blue" />
                    <span>Deadlines (7 Days)</span>
                  </h3>
                  <span className="text-[10px] bg-red-100 border border-red-400 text-red-700 px-2 py-0.5 rounded font-mono font-bold uppercase">Overwatch</span>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-[300px]">
                  {upcomingDeadlines.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => navigate(`tasks/${t.id}`)}
                      className="p-3 bg-white border-2 border-slate-100 hover:border-theme-black hover:bg-theme-cream/20 rounded-2xl transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-950 truncate leading-snug">{t.title}</p>
                        <p className="text-[9px] text-red-500 font-mono mt-0.5 font-bold">DUE: {t.dueDate}</p>
                      </div>
                      <span className="text-[8px] border border-slate-300 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                        {t.status}
                      </span>
                    </div>
                  ))}

                  {upcomingDeadlines.length === 0 && (
                    <div className="py-12 text-center text-slate-400">
                      <Sparkles className="w-6 h-6 text-slate-300 mb-1.5 mx-auto" />
                      <p className="text-[11px] font-bold text-slate-600">Perfect alignment</p>
                      <p className="text-[10px] text-slate-400 italic">No tasks due in the upcoming 7 days.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Grid (User Workload Balance & Admin Access Approvals) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* User Workload Allocation Weight */}
            <div className="bg-white border-2 border-theme-black rounded-3xl p-6 shadow-neo-sm">
              <div className="pb-4 mb-4 border-b-2 border-slate-100 font-sans">
                <h3 className="text-xs font-black tracking-widest text-slate-950 uppercase">
                  Workspace Workload Distributions
                </h3>
              </div>

              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {usersList.filter(u => u.status === UserStatus.APPROVED).map((usr) => {
                  const tasksCount = workloadCounts[usr.id] || 0;
                  const percent = Math.min(100, Math.round((tasksCount / Math.max(1, tasksList.length)) * 100));
                  return (
                    <div key={usr.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-800">{usr.name} <span className="text-slate-400 font-mono text-[9px]">@{usr.username}</span></span>
                        <span className="font-mono text-slate-500 text-[10px] font-bold">{tasksCount} task(s) active</span>
                      </div>
                      {/* Interactive visual gauge bar */}
                      <div className="w-full bg-slate-100 h-3 rounded-full border border-theme-black overflow-hidden relative">
                        <div
                          className="bg-theme-blue h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Admin Approvals Overview */}
            <div className="bg-white border-2 border-theme-black rounded-3xl p-6 shadow-neo-sm">
              <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-slate-100">
                <h3 className="text-xs font-black tracking-widest text-slate-950 uppercase">
                  Account Registration Queue
                </h3>
                <span className="text-[9px] bg-theme-cream border-2 border-theme-black text-slate-950 px-2.5 py-0.5 rounded-full font-mono font-black uppercase">
                  {pendingApprovals.length} Pending
                </span>
              </div>

              {canApprove ? (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {pendingApprovals.map((usr) => (
                    <div key={usr.id} className="p-3 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-950">{usr.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">@{usr.username} • {usr.email}</p>
                      </div>
                      <Button
                        onClick={() => navigate("users")}
                        variant="outline"
                        size="sm"
                        className="text-[10px] border-theme-black text-theme-blue font-bold px-2.5 py-1 rounded-xl"
                      >
                        Approve Screen
                      </Button>
                    </div>
                  ))}

                  {pendingApprovals.length === 0 && (
                    <div className="py-12 text-center text-slate-400 font-sans">
                      <Users className="w-8 h-8 text-slate-200 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-500 font-bold">Queue is empty</p>
                      <p className="text-[10px] text-slate-400 italic">No access approval requests are pending.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4">
                  <UserX className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">Access Denied</p>
                  <p className="text-[10px] text-slate-400 italic max-w-xs mt-0.5 font-medium">
                    Approving user accounts is restricted to Project Managers or Corporate Administrators.
                  </p>
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}

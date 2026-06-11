/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useTask } from "../../hooks/useTask.js";
import { useComments } from "../../hooks/useComments.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { TipTapEditor } from "../editor/TipTapEditor.js";
import { User, Team, Task } from "../../types/index.js";
import { 
  Flame, 
  Calendar, 
  Clock, 
  Users, 
  ArrowLeft, 
  Plus, 
  CheckSquare, 
  MessageSquare, 
  Hourglass, 
  ShieldAlert, 
  Sparkles,
  HelpCircle,
  Clock4,
  GitMerge
} from "lucide-react";

interface TaskDetailsViewProps {
  taskId: string;
}

export function TaskDetailsView({ taskId }: TaskDetailsViewProps) {
  const { task, isLoading: isTaskLoading, error: taskError, refresh: reloadTask, updateTask, logHours } = useTask(taskId);
  const { comments, isLoading: isCommentsLoading, refresh: reloadComments, addComment } = useComments(taskId);
  
  const token = useUIStore((state) => state.token);
  const user = useUIStore((state) => state.user);
  const navigate = useUIStore((state) => state.navigate);

  const [usersList, setUsersList] = useState<User[]>([]);
  const [teamsList, setTeamsList] = useState<Team[]>([]);

  // Assignee Mention resolution states
  const [mentionInput, setMentionInput] = useState("");
  const [mentionResult, setMentionResult] = useState<{ type: "success" | "warning"; message: string } | null>(null);

  // Time logger states
  const [hoursToLog, setHoursToLog] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logStart, setLogStart] = useState("");
  const [logEnd, setLogEnd] = useState("");

  // Comment draft state
  const [commentDraft, setCommentDraft] = useState("");
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

  // Synchronous Gathers
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const [uRes, tRes] = await Promise.all([
          fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (uRes.ok) setUsersList(await uRes.json());
        if (tRes.ok) setTeamsList(await tRes.json());
      } catch (err) {
        console.warn("Could not retrieve team datasets:", err);
      }
    };
    fetchData();
  }, [token]);

  const [allProjectTasks, setAllProjectTasks] = useState<Task[]>([]);

  useEffect(() => {
    const fetchProjectTasks = async () => {
      if (!token || !task?.projectId) return;
      try {
        const res = await fetch(`/api/tasks?projectId=${task.projectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const list = await res.json();
          setAllProjectTasks(list || []);
        }
      } catch (err) {
        console.error("Error loading project tasks for dependencies:", err);
      }
    };
    fetchProjectTasks();
  }, [token, task?.projectId]);

  const handleToggleDependencyOnDetails = async (depId: string) => {
    if (!task) return;
    const currentDeps = task.dependencies || [];
    const updated = currentDeps.includes(depId)
      ? currentDeps.filter(id => id !== depId)
      : [...currentDeps, depId];
    try {
      await updateTask({ dependencies: updated });
      reloadTask();
    } catch (err: any) {
      alert(`Error updating dependencies: ${err.message}`);
    }
  };

  if (isTaskLoading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-purple mx-auto mb-2" />
        <span className="text-xs text-slate-400 font-medium">Downloading task specifications...</span>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="p-6 bg-pink-50 border border-pink-100 rounded-2xl text-theme-pink space-y-4">
        <h3 className="font-bold">Error Accessing Task Sheet</h3>
        <p className="text-xs">{taskError || "Task could not be parsed."}</p>
        <Button onClick={() => navigate("projects")} variant="outline" size="sm">
          Return to projects
        </Button>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: any) => {
    try {
      await updateTask({ status: newStatus });
      reloadTask();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handlePriorityChange = async (newPriority: any) => {
    try {
      await updateTask({ priority: newPriority });
      reloadTask();
    } catch (err: any) {
      alert(`Error updating priority: ${err.message}`);
    }
  };

  // --- MENTION RESOLVER RULES ENGINE ---
  const handleResolveAndAssignMention = async (e: React.FormEvent) => {
    e.preventDefault();
    setMentionResult(null);
    const raw = mentionInput.trim();
    if (!raw) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Rule 5: Email bypass
    if (emailRegex.test(raw)) {
      // Find user with this email or create static bypass assignee
      const match = usersList.find(u => u.email.toLowerCase() === raw.toLowerCase());
      const updatedAssignees = [...(task.assignees || [])];
      
      if (match) {
        if (updatedAssignees.some(a => a.userId === match.id)) {
          setMentionResult({ type: "warning", message: `${raw} is already assigned.` });
          return;
        }
        updatedAssignees.push({ userId: match.id });
      } else {
        // Email bypass assignment (custom string)
        updatedAssignees.push({ userId: raw }); 
      }
      
      await updateTask({ assignees: updatedAssignees });
      setMentionResult({ type: "success", message: `Valid bypass: assigned ${raw} successfully!` });
      setMentionInput("");
      reloadTask();
      return;
    }

    // Rule 1: @TeamName assignment resolution
    if (raw.startsWith("@")) {
      const mentionValue = raw.substring(1);
      const isTeam = teamsList.find(t => t.name.toLowerCase() === mentionValue.toLowerCase());
      
      if (isTeam) {
        // Find members of this team
        const teamUsers = usersList.filter(u => u.teamId === isTeam.id);
        const updatedAssignees = [...(task.assignees || [])];
        let addedCount = 0;

        teamUsers.forEach(tu => {
          if (!updatedAssignees.some(a => a.userId === tu.id)) {
            updatedAssignees.push({ userId: tu.id });
            addedCount++;
          }
        });

        // Also add the team assign capsule
        if (!updatedAssignees.some(a => a.teamId === isTeam.id)) {
          updatedAssignees.push({ teamId: isTeam.id });
        }

        await updateTask({ assignees: updatedAssignees });
        setMentionResult({ 
          type: "success", 
          message: `Assigned all members of @${isTeam.name} successfully (${addedCount} added)!` 
        });
        setMentionInput("");
        reloadTask();
        return;
      }

      // Rule 2 & 3: @Username resolution
      const targetUser = usersList.find(u => u.username.toLowerCase() === mentionValue.toLowerCase());
      if (targetUser) {
        // Rule: Only permit if user belongs to project connected squad/teams or is simply on work active list
        const updatedAssignees = [...(task.assignees || [])];
        if (updatedAssignees.some(a => a.userId === targetUser.id)) {
          setMentionResult({ type: "warning", message: `User @${targetUser.username} is already assigned.` });
          return;
        }

        updatedAssignees.push({ userId: targetUser.id });
        await updateTask({ assignees: updatedAssignees });
        setMentionResult({ type: "success", message: `Successfully assigned @${targetUser.username}!` });
        setMentionInput("");
        reloadTask();
        return;
      }

      // Rule 4: Invalid mention warning, recommend email
      setMentionResult({
        type: "warning",
        message: `Could not resolve "${raw}". Suggest typing their direct email (e.g., mail@pf.com) to bypass.`
      });
      return;
    }

    setMentionResult({
      type: "warning",
      message: "Please preface assignments with '@' for Team/Username, or type a direct email address."
    });
  };

  const handleUnassignMember = async (targetId: string, isTeam: boolean = false) => {
    const updated = (task.assignees || []).filter(a => {
      if (isTeam) return a.teamId !== targetId;
      return a.userId !== targetId;
    });
    try {
      await updateTask({ assignees: updated });
      reloadTask();
    } catch (err: any) {
      alert(`Could not unassign user: ${err.message}`);
    }
  };

  // --- TIME SHEET REGISTRY ---
  const handleLogHoursSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hoursInput = Number(hoursToLog);
    
    // Track interval calculator (if start/end logging is supplied)
    if (logStart && logEnd) {
      const diffMs = new Date(`2000-01-01T${logEnd}`).getTime() - new Date(`2000-01-01T${logStart}`).getTime();
      if (diffMs > 0) {
        hoursInput = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
      }
    }

    if (!hoursInput || hoursInput <= 0) {
      alert("Please supply valid manual hours or active tracking interval range.");
      return;
    }

    try {
      await logHours({
        hours: hoursInput,
        note: logNote || "Manual progress entry.",
        startTime: logStart || undefined,
        endTime: logEnd || undefined
      });

      setHoursToLog("");
      setLogNote("");
      setLogStart("");
      setLogEnd("");
      reloadTask();
    } catch (err: any) {
      alert(`Error logging work hours: ${err.message}`);
    }
  };

  // --- TIPTAP COMMENTS INTERACTION ---
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentDraft.trim()) return;

    setIsCommentSubmitting(true);
    try {
      await addComment(commentDraft);
      setCommentDraft("");
      reloadComments();
    } catch (err: any) {
      alert(`Could not post comment: ${err.message}`);
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const totalLoggedHours = task.timeLogs.reduce((sum, log) => sum + log.hours, 0);

  const getAssigneeLabel = (id: string) => {
    const u = usersList.find(x => x.id === id);
    return u ? `${u.name} (@${u.username})` : id; // fallback if string bypass email
  };

  const getTeamLabel = (id: string) => {
    const t = teamsList.find(x => x.id === id);
    return t ? `@${t.name} Squad` : id;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      
      {/* Return Workspace */}
      <button 
        onClick={() => navigate(`projects/${task.projectId}`)}
        className="inline-flex items-center space-x-1 text-xs text-slate-500 font-bold hover:text-slate-800 transition-colors bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/50 shadow-2xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return Workspace</span>
      </button>

      {/* Task Identification Header Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="text-[10px] font-bold font-mono tracking-wider bg-purple-50 text-theme-purple border border-purple-100 px-2.5 py-0.5 rounded uppercase">
              {task.category}
            </span>
            <span className="text-xs text-slate-400 font-semibold font-mono">
              Workspace Project: {task.projectName}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 font-display mt-2 leading-tight">
            {task.title}
          </h2>
        </div>

        {/* Status Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="task-dt-status" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 font-mono">State Lane</label>
            <select
              id="task-dt-status"
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs font-bold font-mono bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 text-slate-700"
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
            </select>
          </div>

          <div>
            <label htmlFor="task-dt-priority" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 font-mono">Urgency</label>
            <select
              id="task-dt-priority"
              value={task.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="text-xs font-bold font-mono bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 text-slate-700"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Stats column list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Specifications and commentary list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Specifications details */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3.5 font-display flex items-center space-x-1">
              <CheckSquare className="w-4 h-4 text-theme-teal" />
              <span>Technical Specifications Details</span>
            </h3>
            {/* Simple rich display */}
            <div 
              className="text-sm text-slate-600 font-sans leading-relaxed prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: task.richTextDesc || "<p class='italic text-slate-400'>No rich character descriptions or statement entries log.</p>" 
              }}
            />
          </div>

          {/* Time logs tracking sheet entries */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 font-display flex items-center space-x-1.5">
              <Clock4 className="w-4 h-4 text-slate-400" />
              <span>Time Logging Sheet ({totalLoggedHours}h total worked)</span>
            </h3>

            {/* Time logging form */}
            <form onSubmit={handleLogHoursSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="md:col-span-2 space-y-1.5">
                <Input
                  id="h-note"
                  label="Progress description note"
                  placeholder="e.g. Cleared backend query logs..."
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Input
                  id="h-manual"
                  label="Manual Hours log"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 3.5"
                  value={hoursToLog}
                  onChange={(e) => setHoursToLog(e.target.value)}
                  disabled={!!(logStart || logEnd)} // lock if using intervals
                />
              </div>
              <div className="flex md:block">
                <Button type="submit" variant="primary" className="w-full py-2.5">
                  Log Progress
                </Button>
              </div>

              {/* Intervals selection layout */}
              <div className="md:col-span-4 grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <label htmlFor="log-start" className="block text-[10px] text-slate-400 font-bold uppercase font-mono mb-1">Log Start Interval (Optional)</label>
                  <input
                    id="log-start"
                    type="time"
                    value={logStart}
                    onChange={(e) => setLogStart(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-250 rounded-lg font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="log-end" className="block text-[10px] text-slate-400 font-bold uppercase font-mono mb-1">Log End Interval (Optional)</label>
                  <input
                    id="log-end"
                    type="time"
                    value={logEnd}
                    onChange={(e) => setLogEnd(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-250 rounded-lg font-mono focus:outline-none"
                  />
                </div>
              </div>
            </form>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {task.timeLogs && task.timeLogs.length > 0 ? (
                task.timeLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-white border border-slate-150 rounded-xl flex items-center justify-between text-xs hover:border-slate-250 transition-colors">
                    <div>
                      <p className="font-bold text-slate-700">{log.note}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Worker: {log.userName || log.userId} | Logged: {log.createdAt ? log.createdAt.split("T")[0] : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-extrabold text-theme-teal text-[13px] bg-teal-50 border border-teal-200/50 px-2 py-0.5 rounded">
                        {log.hours} hours
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-400 italic text-[11px]">
                  No hour sheets registered on task database.
                </div>
              )}
            </div>
          </div>

          {/* Task Commentary Streams (TipTap Comments) */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 font-display flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span>Commentary Feed thread ({comments.length})</span>
            </h3>

            {/* Comments list */}
            <div className="space-y-4.5 max-h-[300px] overflow-y-auto pr-1">
              {comments.map((cmt) => (
                <div key={cmt.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 bg-purple-100 text-theme-purple font-mono font-bold text-xs uppercase flex items-center justify-center rounded">
                        {cmt.userName.charAt(0)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800">{cmt.userName}</span>
                        <span className="text-[9px] font-bold font-mono tracking-wider bg-slate-200 px-1 py-0.2 rounded ml-1.5 text-slate-500 uppercase">{cmt.userRole}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {cmt.createdAt ? cmt.createdAt.replace("T", " ").substring(0, 16) : ""}
                    </span>
                  </div>
                  {/* TipTap content parse */}
                  <div 
                    className="text-xs text-slate-600 pl-1 prose prose-slate"
                    dangerouslySetInnerHTML={{ 
                      __html: cmt.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/`(.*?)`/g, "<code class='bg-slate-200 text-pink-600 px-0.5 py-0.2 rounded font-mono text-[10px]'>$1</code>")
                        .replace(/@(\w+)/g, "<span class='text-theme-teal font-extrabold focus:outline-none hover:underline cursor-pointer'>@$1</span>")
                    }}
                  />
                </div>
              ))}

              {comments.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic text-[11px]">
                  No comments logged. Initiate discussion sheets using the comments editor.
                </div>
              )}
            </div>

            {/* WYSIWYG rich editor commentary draft */}
            <form onSubmit={handleCommentSubmit} className="space-y-3">
              <TipTapEditor
                value={commentDraft}
                onChange={setCommentDraft}
                placeholder="Participate in work commentary discuss sheet. Support WYSIWYG tags and @Mentions..."
                projectId={task.projectId}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="secondary" size="sm" className="px-5 font-mono" isLoading={isCommentSubmitting}>
                  Post Rich Commentary
                </Button>
              </div>
            </form>
          </div>

        </div>

        {/* Sidebar assigns resolver & deadlines overview */}
        <div className="space-y-6">
          
          {/* Mentions Resolver Block */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 font-display flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-theme-teal" />
              <span>Mentions Dispatch Assigns</span>
            </h3>

            {/* Rules instruction info */}
            <div className="text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-150 leading-relaxed font-medium text-slate-500">
              <p className="font-bold flex items-center space-x-1 text-slate-700 mb-1">
                <HelpCircle className="w-3.5 h-3.5 text-theme-teal" />
                <span>Assignment rules dispatch:</span>
              </p>
              <ul className="list-disc pl-3.5 space-y-0.5">
                <li><strong className="text-slate-600">@TeamName</strong>: assigns entire core squad.</li>
                <li><strong className="text-slate-600">@Username</strong>: maps specific staff profile.</li>
                <li><strong className="text-slate-600">full@email.com</strong>: bypasses valid bypass triggers.</li>
              </ul>
            </div>

            {/* Trigger form */}
            <form onSubmit={handleResolveAndAssignMention} className="space-y-2">
              <Input
                id="dispatch-lookup"
                label="Dispatch Resolve Command"
                placeholder="e.g. @Design or member@email.com"
                value={mentionInput}
                onChange={(e) => setMentionInput(e.target.value)}
              />
              <Button type="submit" variant="outline" size="sm" className="w-full text-xs py-2 font-mono">
                Resolve & Assign
              </Button>
            </form>

            {mentionResult && (
              <div className={`p-2.5 rounded-lg text-xs leading-normal font-semibold flex items-start space-x-1.5 ${
                mentionResult.type === "success" 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                  : "bg-pink-50 text-theme-pink border border-pink-100"
              }`}>
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{mentionResult.message}</span>
              </div>
            )}

            {/* Current assignees */}
            <div className="space-y-2 pt-2">
              <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Current Task Assignees</h4>
              <div className="space-y-1.5">
                {task.assignees && task.assignees.length > 0 ? (
                  task.assignees.map((asg, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-semibold">
                      <span className="truncate pr-2">
                        {asg.userId ? getAssigneeLabel(asg.userId) : asg.teamId ? getTeamLabel(asg.teamId) : "Assignee"}
                      </span>
                      <button
                        onClick={() => handleUnassignMember(asg.userId || asg.teamId || "", !!asg.teamId)}
                        className="text-theme-pink hover:underline font-mono text-[10px] font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No members assigned to this task sheets.</p>
                )}
              </div>
            </div>

          </div>

          {/* Task Dependencies & Blocker Chain */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1.5 border-b border-slate-100 font-display flex items-center space-x-1.5">
              <GitMerge className="w-4 h-4 text-theme-yellow" />
              <span>Dependencies Chain Links</span>
            </h3>

            {/* List of prerequisites */}
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono mb-2">Prerequisites (Must complete first)</h4>
                {task.dependencies && task.dependencies.length > 0 ? (
                  <div className="space-y-2">
                    {task.dependencies.map((depId) => {
                      const depTask = allProjectTasks.find(t => t.id === depId);
                      if (!depTask) return null;
                      const isComplete = depTask.status === "Done";
                      return (
                        <div key={depId} className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          isComplete 
                            ? "bg-slate-50/50 border-slate-150 text-slate-500" 
                            : "bg-amber-50/30 border-amber-200/50 text-slate-800"
                        }`}>
                          <div className="min-w-0 flex-1 pr-2">
                            <span 
                              className={`block font-semibold truncate hover:underline cursor-pointer ${
                                isComplete ? "line-through text-slate-455" : "text-slate-800"
                              }`}
                              onClick={() => navigate(`tasks/${depTask.id}`)}
                              title="Click to view dependency sheet"
                            >
                              {depTask.title}
                            </span>
                            <span className="text-[9px] font-mono capitalize">
                              Lane: <strong className={isComplete ? "text-emerald-600" : "text-amber-500 font-bold"}>{depTask.status}</strong>
                            </span>
                          </div>
                          
                          <button
                            onClick={() => handleToggleDependencyOnDetails(depId)}
                            className="text-[9px] font-mono text-slate-400 hover:text-pink-600 font-bold ml-1 shrink-0"
                            title="Remove dependency relationship"
                          >
                            Disconnect
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No preceding task dependencies configured.</p>
                )}
              </div>

              {/* List of successors */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono mb-2">Dependent Tasks (Blocked by this)</h4>
                {(() => {
                  const successors = allProjectTasks.filter(t => !t.deleted && t.dependencies && t.dependencies.includes(task.id));
                  if (successors.length > 0) {
                    return (
                      <div className="space-y-1.5">
                        {successors.map(suc => (
                          <div key={suc.id} className="p-2 bg-slate-50/50 border border-slate-150 rounded-xl flex items-center justify-between text-xs font-medium">
                            <span 
                              onClick={() => navigate(`tasks/${suc.id}`)}
                              className="truncate pr-2 hover:underline cursor-pointer font-semibold text-slate-700"
                              title="Click to view blocker successor"
                            >
                              {suc.title}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">{suc.status}</span>
                          </div>
                        ))}
                      </div>
                    );
                  } else {
                    return <p className="text-xs text-slate-400 italic">No other tasks depend on this sheet item.</p>;
                  }
                })()}
              </div>

              {/* Add dependencies section */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono mb-1.5 font-semibold">Link New Dependency</h4>
                {allProjectTasks.filter(t => !t.deleted && t.id !== task.id && !(task.dependencies || []).includes(t.id)).length > 0 ? (
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          handleToggleDependencyOnDetails(val);
                          e.target.value = ""; // reset select
                        }
                      }}
                      className="w-full text-xs font-mono bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 text-slate-700 font-bold cursor-pointer"
                      defaultValue=""
                    >
                      <option value="">-- Choose Pre-requisite task --</option>
                      {allProjectTasks
                        .filter(t => !t.deleted && t.id !== task.id && !(task.dependencies || []).includes(t.id))
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            [{t.category}] {t.title} ({t.status})
                          </option>
                        ))
                      }
                    </select>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic font-mono">All other available tasks are already linked or none exist.</p>
                )}
              </div>

            </div>
          </div>

          {/* Details Overview Block */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 font-display">Sheet Deadlines Overview</h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">DUE DATE:</span>
                <span className="font-extrabold text-slate-800">{task.dueDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">ESTIMATE TIME:</span>
                <span className="font-extrabold text-slate-800">{task.estimatedHours} Hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">TOTAL LOGGED:</span>
                <span className="font-extrabold text-slate-800">{totalLoggedHours} Hours</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

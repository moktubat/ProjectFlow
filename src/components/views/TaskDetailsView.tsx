import React, { useState, useEffect } from "react";
import { useTask } from "../../hooks/useTask.js";
import { useComments } from "../../hooks/useComments.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { TipTapEditor } from "../editor/TipTapEditor.js";
import { User, Team, Task } from "../../types/index.js";
import { ArrowLeft, Users, Clock, MessageSquare, GitMerge, AlertCircle, HelpCircle, CheckSquare } from "lucide-react";

export function TaskDetailsView({ taskId }: { taskId: string }) {
  const { task, isLoading, error, refresh: reloadTask, updateTask, logHours } = useTask(taskId);
  const { comments, refresh: reloadComments, addComment } = useComments(taskId);
  const token = useUIStore((s) => s.token);
  const navigate = useUIStore((s) => s.navigate);

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projTasks, setProjTasks] = useState<Task[]>([]);
  const [mentionInput, setMentionInput] = useState("");
  const [mentionResult, setMentionResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [hours, setHours] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logStart, setLogStart] = useState("");
  const [logEnd, setLogEnd] = useState("");
  const [comment, setComment] = useState("");
  const [commBusy, setCommBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([u, t]) => {
      if (u.ok) setUsers(await u.json());
      if (t.ok) setTeams(await t.json());
    });
  }, [token]);

  useEffect(() => {
    if (!token || !task?.projectId) return;
    fetch(`/api/tasks?projectId=${task.projectId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : []).then(setProjTasks);
  }, [token, task?.projectId]);

  if (isLoading) return (
    <div className="flex justify-center py-24">
      <div className="w-7 h-7 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !task) return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
      <p className="text-sm font-medium text-red-700 mb-1">Task not found</p>
      <p className="text-sm text-red-600">{error}</p>
      <Button onClick={() => navigate("projects")} variant="outline" size="sm" className="mt-3">Back</Button>
    </div>
  );

  const totalLogged = task.timeLogs.reduce((s, l) => s + l.hours, 0);
  const getName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const getTeamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;

  const changeStatus = (v: any) => updateTask({ status: v }).catch((e: any) => alert(e.message));
  const changePriority = (v: any) => updateTask({ priority: v }).catch((e: any) => alert(e.message));

  const handleLogHours = async (e: React.FormEvent) => {
    e.preventDefault();
    let h = Number(hours);
    if (logStart && logEnd) {
      const diff = new Date(`2000-01-01T${logEnd}`).getTime() - new Date(`2000-01-01T${logStart}`).getTime();
      if (diff > 0) h = parseFloat((diff / 3600000).toFixed(2));
    }
    if (!h || h <= 0) { alert("Enter valid hours."); return; }
    try {
      await logHours({ hours: h, note: logNote || "Manual entry.", startTime: logStart || undefined, endTime: logEnd || undefined });
      setHours(""); setLogNote(""); setLogStart(""); setLogEnd("");
    } catch (e: any) { alert(e.message); }
  };

  const handleMentionAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = mentionInput.trim();
    if (!raw) return;
    setMentionResult(null);
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const updateAsgn = async (newAsgn: any[]) => {
      try { await updateTask({ assignees: newAsgn }); reloadTask(); } catch (e: any) { setMentionResult({ ok: false, msg: e.message }); }
    };

    if (emailRx.test(raw)) {
      const u = users.find((x) => x.email.toLowerCase() === raw.toLowerCase());
      const list = [...task.assignees];
      if (u) {
        if (list.some((a) => a.userId === u.id)) { setMentionResult({ ok: false, msg: "Already assigned." }); return; }
        list.push({ userId: u.id });
      } else { list.push({ userId: raw }); }
      await updateAsgn(list);
      setMentionResult({ ok: true, msg: `Assigned ${raw}` }); setMentionInput(""); return;
    }

    if (raw.startsWith("@")) {
      const val = raw.slice(1);
      const team = teams.find((t) => t.name.toLowerCase() === val.toLowerCase());
      if (team) {
        const list = [...task.assignees];
        const members = users.filter((u) => u.teamId === team.id);
        let added = 0;
        members.forEach((u) => { if (!list.some((a) => a.userId === u.id)) { list.push({ userId: u.id }); added++; } });
        if (!list.some((a) => a.teamId === team.id)) list.push({ teamId: team.id });
        await updateAsgn(list);
        setMentionResult({ ok: true, msg: `Added @${team.name} (${added} members)` }); setMentionInput(""); return;
      }
      const u = users.find((x) => x.username.toLowerCase() === val.toLowerCase());
      if (u) {
        if (task.assignees.some((a) => a.userId === u.id)) { setMentionResult({ ok: false, msg: "Already assigned." }); return; }
        await updateAsgn([...task.assignees, { userId: u.id }]);
        setMentionResult({ ok: true, msg: `Assigned @${u.username}` }); setMentionInput(""); return;
      }
      setMentionResult({ ok: false, msg: `Could not find "${raw}".` }); return;
    }
    setMentionResult({ ok: false, msg: "Use @username, @team, or email." });
  };

  const unassign = async (id: string, isTeam = false) => {
    const list = task.assignees.filter((a) => isTeam ? a.teamId !== id : a.userId !== id);
    try { await updateTask({ assignees: list }); reloadTask(); } catch (e: any) { alert(e.message); }
  };

  const toggleDep = async (depId: string) => {
    const deps = (task.dependencies ?? []).includes(depId)
      ? task.dependencies!.filter((d) => d !== depId)
      : [...(task.dependencies ?? []), depId];
    try { await updateTask({ dependencies: deps }); reloadTask(); } catch (e: any) { alert(e.message); }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommBusy(true);
    try { await addComment(comment); setComment(""); reloadComments(); } catch (e: any) { alert(e.message); }
    finally { setCommBusy(false); }
  };

  const SEL = "px-3 py-1.5 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]";

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(`projects/${task.projectId}`)} className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#111111] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to project
      </button>

      {/* Header */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs bg-[#e8edfb] text-[#0038BC] px-2 py-0.5 rounded-md">{task.category}</span>
              <span className="text-xs text-[#A0A0A0]">{task.projectName}</span>
            </div>
            <h1 className="text-lg font-semibold text-[#111111]">{task.title}</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div>
              <label className="block text-xs text-[#737373] mb-1">Status</label>
              <select value={task.status} onChange={(e) => changeStatus(e.target.value)} className={SEL}>
                {["To Do","In Progress","Review","Done"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#737373] mb-1">Priority</label>
              <select value={task.priority} onChange={(e) => changePriority(e.target.value)} className={SEL}>
                {["Low","Medium","High","Critical"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="w-3.5 h-3.5 text-[#737373]" />
              <p className="text-sm font-medium text-[#111111]">Description</p>
            </div>
            {task.richTextDesc
              ? <div className="prose prose-sm max-w-none text-[#525252]" dangerouslySetInnerHTML={{ __html: task.richTextDesc }} />
              : <p className="text-sm text-[#A0A0A0] italic">No description provided.</p>}
          </div>

          {/* Time tracking */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#737373]" />
                <p className="text-sm font-medium text-[#111111]">Time tracking</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-[#EEEEEE] rounded-full">
                  <div className="h-full bg-[#0038BC] rounded-full" style={{ width: `${Math.min(100, task.estimatedHours > 0 ? (totalLogged / task.estimatedHours) * 100 : 0)}%` }} />
                </div>
                <span className="text-xs text-[#737373]">{totalLogged}h / {task.estimatedHours}h</span>
              </div>
            </div>
            <form onSubmit={handleLogHours} className="space-y-3 pb-4 border-b border-[#F4F4F4] mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input label="Hours" type="number" step="0.1" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="2.5" disabled={!!(logStart && logEnd)} />
                <div className="sm:col-span-2">
                  <Input label="Note" value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="What did you work on?" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start time" type="time" value={logStart} onChange={(e) => setLogStart(e.target.value)} />
                <Input label="End time" type="time" value={logEnd} onChange={(e) => setLogEnd(e.target.value)} />
              </div>
              <Button type="submit" variant="primary" size="sm">Log time</Button>
            </form>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {task.timeLogs.length > 0 ? task.timeLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-2.5 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg">
                  <div>
                    <p className="text-sm text-[#111111]">{l.note}</p>
                    <p className="text-xs text-[#737373]">{l.userName ?? l.userId} · {l.createdAt?.split("T")[0]}</p>
                  </div>
                  <span className="text-sm font-medium text-[#0038BC]">{l.hours}h</span>
                </div>
              )) : <p className="text-sm text-[#A0A0A0] text-center py-2">No time logged yet.</p>}
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-3.5 h-3.5 text-[#737373]" />
              <p className="text-sm font-medium text-[#111111]">Comments ({comments.length})</p>
            </div>
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="p-3 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#e8edfb] text-[#0038BC] text-xs font-medium flex items-center justify-center">
                        {c.userName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-[#111111]">{c.userName}</span>
                      <span className="text-xs text-[#737373] bg-[#EEEEEE] px-1.5 py-0.5 rounded">{c.userRole}</span>
                    </div>
                    <span className="text-xs text-[#A0A0A0]">{c.createdAt?.replace("T"," ").substring(0,16)}</span>
                  </div>
                  <div className="text-sm text-[#525252] prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: c.content.replace(/@(\w+)/g, "<span class='text-[#0038BC] font-medium'>@$1</span>") }} />
                </div>
              ))}
              {comments.length === 0 && <p className="text-sm text-[#A0A0A0] text-center py-3">No comments yet.</p>}
            </div>
            <form onSubmit={handleComment} className="space-y-2">
              <TipTapEditor value={comment} onChange={setComment} placeholder="Add a comment…" projectId={task.projectId} />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" isLoading={commBusy}>Post</Button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Task info */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <p className="text-sm font-medium text-[#111111] mb-3">Details</p>
            <div className="space-y-0">
              {[["Due date", task.dueDate], ["Estimated", `${task.estimatedHours}h`], ["Logged", `${totalLogged}h`]].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between py-2 border-b border-[#F4F4F4] last:border-0">
                  <span className="text-xs text-[#737373]">{l}</span>
                  <span className="text-sm text-[#111111]">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 text-[#737373]" />
              <p className="text-sm font-medium text-[#111111]">Assignees</p>
            </div>
            <div className="bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg p-2.5 mb-3">
              <p className="flex items-center gap-1 text-xs font-medium text-[#525252] mb-1.5"><HelpCircle className="w-3 h-3 text-[#737373]" />How to assign</p>
              <p className="text-xs text-[#737373]"><span className="font-medium text-[#111111]">@username</span> or <span className="font-medium text-[#111111]">@TeamName</span> or <span className="font-medium text-[#111111]">email@co.com</span></p>
            </div>
            <form onSubmit={handleMentionAssign} className="flex gap-2 mb-3">
              <input value={mentionInput} onChange={(e) => setMentionInput(e.target.value)}
                placeholder="@user, @team, or email"
                className="flex-1 px-2.5 py-1.5 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]" />
              <Button type="submit" variant="outline" size="sm">Assign</Button>
            </form>
            {mentionResult && (
              <div className={`flex items-start gap-2 p-2 rounded-lg text-xs mb-3 ${mentionResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{mentionResult.msg}
              </div>
            )}
            <div className="space-y-1.5">
              {task.assignees.length > 0 ? task.assignees.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg">
                  <span className="text-sm text-[#525252] truncate">{a.userId ? getName(a.userId) : `@${getTeamName(a.teamId!)}`}</span>
                  <button onClick={() => unassign(a.userId ?? a.teamId!, !!a.teamId)} className="text-xs text-red-600 hover:underline ml-2 shrink-0">Remove</button>
                </div>
              )) : <p className="text-xs text-[#A0A0A0]">No assignees yet.</p>}
            </div>
          </div>

          {/* Dependencies */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitMerge className="w-3.5 h-3.5 text-[#737373]" />
              <p className="text-sm font-medium text-[#111111]">Dependencies</p>
            </div>
            {(task.dependencies ?? []).length > 0 ? (
              <div className="space-y-1.5 mb-3">
                {task.dependencies!.map((depId) => {
                  const dep = projTasks.find((t) => t.id === depId);
                  if (!dep) return null;
                  const done = dep.status === "Done";
                  return (
                    <div key={depId} className={`flex items-center justify-between p-2 rounded-lg border text-sm ${done ? "bg-green-50 border-green-200" : "bg-[#fef3dc] border-[#EF8F00]/30"}`}>
                      <button onClick={() => navigate(`tasks/${dep.id}`)} className={`truncate text-left text-xs hover:underline ${done ? "text-green-700 line-through" : "text-[#111111]"}`}>
                        {dep.title}
                      </button>
                      <button onClick={() => toggleDep(depId)} className="text-xs text-red-600 hover:underline ml-2 shrink-0">Remove</button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-xs text-[#A0A0A0] mb-3">No dependencies.</p>}
            {projTasks.filter((t) => !t.deleted && t.id !== task.id && !(task.dependencies ?? []).includes(t.id)).length > 0 && (
              <select onChange={(e) => { if (e.target.value) { toggleDep(e.target.value); (e.target as any).value = ""; } }}
                className="w-full px-2.5 py-1.5 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC] bg-white" defaultValue="">
                <option value="">Add dependency…</option>
                {projTasks.filter((t) => !t.deleted && t.id !== task.id && !(task.dependencies ?? []).includes(t.id))
                  .map((t) => <option key={t.id} value={t.id}>[{t.category}] {t.title}</option>)}
              </select>
            )}
            {projTasks.filter((t) => !t.deleted && t.dependencies?.includes(task.id)).length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#E8E8E8]">
                <p className="text-xs text-[#737373] mb-1.5">Blocked by this task:</p>
                {projTasks.filter((t) => !t.deleted && t.dependencies?.includes(task.id)).map((t) => (
                  <button key={t.id} onClick={() => navigate(`tasks/${t.id}`)} className="block text-xs text-[#0038BC] hover:underline truncate w-full text-left py-0.5">{t.title}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
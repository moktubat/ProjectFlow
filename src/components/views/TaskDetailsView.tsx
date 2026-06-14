import React, { useState, useEffect, useCallback } from "react";
import { useTask } from "../../hooks/useTask.js";
import { useComments } from "../../hooks/useComments.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { TipTapEditor } from "../editor/TipTapEditor.js";
import { User, Team, Task, SubTask } from "../../types/index.js";
import {
  ArrowLeft, Users, Clock, MessageSquare, GitMerge, AlertCircle,
  HelpCircle, CheckSquare, Plus, Trash2, CheckCircle2, Circle,
  Pencil, Check, X,
} from "lucide-react";

// ─── inline-editable text ────────────────────────────────────────────────────
function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = async () => {
    if (draft.trim() && draft !== value) await onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 w-full">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className="flex-1 text-lg font-semibold text-[#111111] border-b-2 border-[#0038BC] bg-transparent focus:outline-none py-0.5"
        />
        <button onClick={commit} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="p-1 text-[#737373] hover:bg-[#F4F4F4] rounded"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 group">
      <h1 className="text-lg font-semibold text-[#111111] leading-snug">{value}</h1>
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 p-1 text-[#A0A0A0] hover:text-[#0038BC] hover:bg-[#e8edfb] rounded transition-all mt-0.5"
        title="Edit title"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── sub-task list ────────────────────────────────────────────────────────────
function SubTaskList({
  subTasks,
  onUpdate,
}: {
  subTasks: SubTask[];
  onUpdate: (sub: SubTask[]) => Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const toggle = async (id: string) => {
    const updated = subTasks.map((s) =>
      s.id === id ? { ...s, completed: !s.completed } : s
    );
    await onUpdate(updated);
  };

  const addSub = async () => {
    if (!newTitle.trim()) return;
    const sub: SubTask = {
      id: "sub_" + Math.random().toString(36).substr(2, 8),
      title: newTitle.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await onUpdate([...subTasks, sub]);
    setNewTitle("");
    setAdding(false);
  };

  const deleteS = async (id: string) => {
    await onUpdate(subTasks.filter((s) => s.id !== id));
  };

  const saveEdit = async (id: string) => {
    if (!editVal.trim()) return;
    await onUpdate(subTasks.map((s) => s.id === id ? { ...s, title: editVal.trim() } : s));
    setEditId(null);
  };

  const done = subTasks.filter((s) => s.completed).length;

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-3.5 h-3.5 text-[#737373]" />
          <p className="text-sm font-medium text-[#111111]">
            Sub-tasks
            {subTasks.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-[#737373]">
                {done}/{subTasks.length}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-[#0038BC] hover:underline font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {/* Progress bar */}
      {subTasks.length > 0 && (
        <div className="w-full h-1.5 bg-[#EEEEEE] rounded-full mb-3">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${Math.round((done / subTasks.length) * 100)}%` }}
          />
        </div>
      )}

      <div className="space-y-1.5">
        {subTasks.map((s) =>
          editId === s.id ? (
            <div key={s.id} className="flex items-center gap-2">
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(s.id); if (e.key === "Escape") setEditId(null); }}
                className="flex-1 px-2.5 py-1.5 border border-[#0038BC] rounded-lg text-sm focus:outline-none"
              />
              <button onClick={() => saveEdit(s.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-[#737373] hover:bg-[#F4F4F4] rounded"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div key={s.id} className="flex items-center gap-2.5 group px-1 py-0.5 rounded-lg hover:bg-[#F7F8FA]">
              <button
                onClick={() => toggle(s.id)}
                className={`shrink-0 transition-colors ${s.completed ? "text-green-500" : "text-[#D0D0D0] hover:text-[#A0A0A0]"}`}
              >
                {s.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </button>
              <span className={`flex-1 text-sm ${s.completed ? "line-through text-[#A0A0A0]" : "text-[#525252]"}`}>
                {s.title}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditVal(s.title); setEditId(s.id); }}
                  className="p-1 text-[#A0A0A0] hover:text-[#0038BC] hover:bg-[#e8edfb] rounded"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteS(s.id)}
                  className="p-1 text-[#A0A0A0] hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        )}

        {subTasks.length === 0 && !adding && (
          <p className="text-xs text-[#A0A0A0] text-center py-2">No sub-tasks yet.</p>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-2 mt-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addSub(); if (e.key === "Escape") { setAdding(false); setNewTitle(""); } }}
            placeholder="Sub-task title…"
            className="flex-1 px-2.5 py-1.5 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]"
          />
          <button onClick={addSub} className="p-1.5 bg-[#0038BC] text-white rounded-lg hover:bg-[#002fa3]"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setAdding(false); setNewTitle(""); }} className="p-1.5 text-[#737373] hover:bg-[#F4F4F4] rounded-lg"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}

// ─── main view ────────────────────────────────────────────────────────────────
export function TaskDetailsView({ taskId }: { taskId: string }) {
  const { task, isLoading, error, refresh: reloadTask, updateTask, logHours } = useTask(taskId);
  const { comments, refresh: reloadComments, addComment } = useComments(taskId);
  const token = useUIStore((s) => s.token);
  const navigate = useUIStore((s) => s.navigate);

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projTasks, setProjTasks] = useState<Task[]>([]);

  // Mention / assign
  const [mentionInput, setMentionInput] = useState("");
  const [mentionResult, setMentionResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Time log
  const [hours, setHours] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logStart, setLogStart] = useState("");
  const [logEnd, setLogEnd] = useState("");

  // Comment
  const [comment, setComment] = useState("");
  const [commBusy, setCommBusy] = useState(false);

  // Inline description editing
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

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
      .then((r) => (r.ok ? r.json() : []))
      .then(setProjTasks);
  }, [token, task?.projectId]);

  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <div className="w-7 h-7 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error || !task)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-sm font-medium text-red-700 mb-1">Task not found</p>
        <p className="text-sm text-red-600">{error}</p>
        <Button onClick={() => navigate("projects")} variant="outline" size="sm" className="mt-3">
          Back
        </Button>
      </div>
    );

  const totalLogged = task.timeLogs.reduce((s, l) => s + l.hours, 0);
  const getName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const getTeamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;

  const changeStatus = (v: any) => updateTask({ status: v }).catch((e: any) => alert(e.message));
  const changePriority = (v: any) => updateTask({ priority: v }).catch((e: any) => alert(e.message));
  const changeDueDate = (v: string) => updateTask({ dueDate: v }).catch((e: any) => alert(e.message));
  const changeEstHours = (v: string) => {
    const n = parseFloat(v);
    if (!isNaN(n) && n >= 0) updateTask({ estimatedHours: n }).catch((e: any) => alert(e.message));
  };

  const saveTitle = async (title: string) => {
    await updateTask({ title }).catch((e: any) => alert(e.message));
    reloadTask();
  };

  const saveDesc = async () => {
    await updateTask({ richTextDesc: descDraft }).catch((e: any) => alert(e.message));
    setEditingDesc(false);
    reloadTask();
  };

  const saveSubTasks = async (subTasks: SubTask[]) => {
    await updateTask({ subTasks } as any).catch((e: any) => alert(e.message));
    reloadTask();
  };

  const handleLogHours = async (e: React.FormEvent) => {
    e.preventDefault();
    let h = Number(hours);
    if (logStart && logEnd) {
      const diff =
        new Date(`2000-01-01T${logEnd}`).getTime() -
        new Date(`2000-01-01T${logStart}`).getTime();
      if (diff > 0) h = parseFloat((diff / 3600000).toFixed(2));
    }
    if (!h || h <= 0) { alert("Enter valid hours."); return; }
    try {
      await logHours({
        hours: h,
        note: logNote || "Manual entry.",
        startTime: logStart || undefined,
        endTime: logEnd || undefined,
      });
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
      try {
        await updateTask({ assignees: newAsgn });
        reloadTask();
      } catch (e: any) {
        setMentionResult({ ok: false, msg: e.message });
      }
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
    const list = task.assignees.filter((a) => (isTeam ? a.teamId !== id : a.userId !== id));
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

  const SEL =
    "px-3 py-1.5 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]";

  const subTasks: SubTask[] = (task as any).subTasks ?? [];

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(`projects/${task.projectId}`)}
        className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#111111] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to project
      </button>

      {/* ── Header ── */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-[#e8edfb] text-[#0038BC] px-2 py-0.5 rounded-md">
                {task.category}
              </span>
              <span className="text-xs text-[#A0A0A0]">{task.projectName}</span>
            </div>
            <EditableTitle value={task.title} onSave={saveTitle} />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div>
              <label className="block text-xs text-[#737373] mb-1">Status</label>
              <select value={task.status} onChange={(e) => changeStatus(e.target.value)} className={SEL}>
                {["To Do", "In Progress", "Review", "Done"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#737373] mb-1">Priority</label>
              <select value={task.priority} onChange={(e) => changePriority(e.target.value)} className={SEL}>
                {["Low", "Medium", "High", "Critical"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description — inline editable */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-[#737373]" />
                <p className="text-sm font-medium text-[#111111]">Description</p>
              </div>
              {!editingDesc && (
                <button
                  onClick={() => { setDescDraft(task.richTextDesc); setEditingDesc(true); }}
                  className="flex items-center gap-1 text-xs text-[#737373] hover:text-[#0038BC] hover:bg-[#e8edfb] px-2 py-1 rounded-lg transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-3">
                <TipTapEditor
                  value={descDraft}
                  onChange={setDescDraft}
                  projectId={task.projectId}
                  placeholder="Describe what needs to be done…"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={saveDesc}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingDesc(false)}>Cancel</Button>
                </div>
              </div>
            ) : task.richTextDesc ? (
              <div
                className="prose prose-sm max-w-none text-[#525252]"
                dangerouslySetInnerHTML={{ __html: task.richTextDesc }}
              />
            ) : (
              <p className="text-sm text-[#A0A0A0] italic">
                No description yet.{" "}
                <button
                  onClick={() => { setDescDraft(""); setEditingDesc(true); }}
                  className="text-[#0038BC] not-italic hover:underline"
                >
                  Add one
                </button>
              </p>
            )}
          </div>

          {/* Sub-tasks */}
          <SubTaskList subTasks={subTasks} onUpdate={saveSubTasks} />

          {/* Time tracking */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#737373]" />
                <p className="text-sm font-medium text-[#111111]">Time tracking</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-[#EEEEEE] rounded-full">
                  <div
                    className="h-full bg-[#0038BC] rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        task.estimatedHours > 0 ? (totalLogged / task.estimatedHours) * 100 : 0
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-[#737373]">
                  {totalLogged}h / {task.estimatedHours}h
                </span>
              </div>
            </div>
            <form onSubmit={handleLogHours} className="space-y-3 pb-4 border-b border-[#F4F4F4] mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Hours"
                  type="number"
                  step="0.1"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="2.5"
                  disabled={!!(logStart && logEnd)}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Note"
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    placeholder="What did you work on?"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start time" type="time" value={logStart} onChange={(e) => setLogStart(e.target.value)} />
                <Input label="End time" type="time" value={logEnd} onChange={(e) => setLogEnd(e.target.value)} />
              </div>
              <Button type="submit" variant="primary" size="sm">Log time</Button>
            </form>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {task.timeLogs.length > 0 ? (
                task.timeLogs.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between p-2.5 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg"
                  >
                    <div>
                      <p className="text-sm text-[#111111]">{l.note}</p>
                      <p className="text-xs text-[#737373]">
                        {l.userName ?? l.userId} · {l.createdAt?.split("T")[0]}
                        {l.startTime && l.endTime && (
                          <span className="ml-1 text-[#A0A0A0]">
                            ({l.startTime} – {l.endTime})
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-[#0038BC]">{l.hours}h</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#A0A0A0] text-center py-2">No time logged yet.</p>
              )}
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
                      <span className="text-xs text-[#737373] bg-[#EEEEEE] px-1.5 py-0.5 rounded">
                        {c.userRole}
                      </span>
                    </div>
                    <span className="text-xs text-[#A0A0A0]">
                      {c.createdAt?.replace("T", " ").substring(0, 16)}
                    </span>
                  </div>
                  <div
                    className="text-sm text-[#525252] prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: c.content.replace(
                        /@(\w+)/g,
                        "<span class='text-[#0038BC] font-medium'>@$1</span>"
                      ),
                    }}
                  />
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-[#A0A0A0] text-center py-3">No comments yet.</p>
              )}
            </div>
            <form onSubmit={handleComment} className="space-y-2">
              <TipTapEditor
                value={comment}
                onChange={setComment}
                placeholder="Add a comment…"
                projectId={task.projectId}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" isLoading={commBusy}>
                  Post
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Editable details */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <p className="text-sm font-medium text-[#111111] mb-3">Details</p>
            <div className="space-y-0">
              {/* Due date — inline editable */}
              <div className="flex items-center justify-between py-2 border-b border-[#F4F4F4]">
                <span className="text-xs text-[#737373]">Due date</span>
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={(e) => changeDueDate(e.target.value)}
                  className="text-sm text-[#111111] border-b border-transparent hover:border-[#D0D0D0] focus:border-[#0038BC] bg-transparent focus:outline-none cursor-pointer"
                />
              </div>
              {/* Estimated hours — inline editable */}
              <div className="flex items-center justify-between py-2 border-b border-[#F4F4F4]">
                <span className="text-xs text-[#737373]">Estimated</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={task.estimatedHours}
                  onChange={(e) => changeEstHours(e.target.value)}
                  className="w-20 text-sm text-[#111111] text-right border-b border-transparent hover:border-[#D0D0D0] focus:border-[#0038BC] bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-[#737373]">Logged</span>
                <span className="text-sm text-[#111111]">{totalLogged}h</span>
              </div>
            </div>
          </div>

          {/* Assignees */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 text-[#737373]" />
              <p className="text-sm font-medium text-[#111111]">Assignees</p>
            </div>
            <div className="bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg p-2.5 mb-3">
              <p className="flex items-center gap-1 text-xs font-medium text-[#525252] mb-1.5">
                <HelpCircle className="w-3 h-3 text-[#737373]" /> How to assign
              </p>
              <p className="text-xs text-[#737373]">
                <span className="font-medium text-[#111111]">@username</span> ·{" "}
                <span className="font-medium text-[#111111]">@TeamName</span> ·{" "}
                <span className="font-medium text-[#111111]">email@co.com</span>
              </p>
            </div>
            <form onSubmit={handleMentionAssign} className="flex gap-2 mb-3">
              <input
                value={mentionInput}
                onChange={(e) => setMentionInput(e.target.value)}
                placeholder="@user, @team, or email"
                className="flex-1 px-2.5 py-1.5 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]"
              />
              <Button type="submit" variant="outline" size="sm">Assign</Button>
            </form>
            {mentionResult && (
              <div
                className={`flex items-start gap-2 p-2 rounded-lg text-xs mb-3 ${mentionResult.ok
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                  }`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {mentionResult.msg}
              </div>
            )}
            <div className="space-y-1.5">
              {task.assignees.length > 0 ? (
                task.assignees.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg"
                  >
                    <span className="text-sm text-[#525252] truncate">
                      {a.userId ? getName(a.userId) : `@${getTeamName(a.teamId!)}`}
                    </span>
                    <button
                      onClick={() => unassign(a.userId ?? a.teamId!, !!a.teamId)}
                      className="text-xs text-red-600 hover:underline ml-2 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#A0A0A0]">No assignees yet.</p>
              )}
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
                    <div
                      key={depId}
                      className={`flex items-center justify-between p-2 rounded-lg border text-sm ${done ? "bg-green-50 border-green-200" : "bg-[#fef3dc] border-[#EF8F00]/30"
                        }`}
                    >
                      <button
                        onClick={() => navigate(`tasks/${dep.id}`)}
                        className={`truncate text-left text-xs hover:underline ${done ? "text-green-700 line-through" : "text-[#111111]"
                          }`}
                      >
                        {dep.title}
                      </button>
                      <button
                        onClick={() => toggleDep(depId)}
                        className="text-xs text-red-600 hover:underline ml-2 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#A0A0A0] mb-3">No dependencies.</p>
            )}
            {projTasks.filter(
              (t) =>
                !t.deleted &&
                t.id !== task.id &&
                !(task.dependencies ?? []).includes(t.id)
            ).length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) { toggleDep(e.target.value); (e.target as any).value = ""; }
                  }}
                  className="w-full px-2.5 py-1.5 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC] bg-white"
                  defaultValue=""
                >
                  <option value="">Add dependency…</option>
                  {projTasks
                    .filter(
                      (t) =>
                        !t.deleted &&
                        t.id !== task.id &&
                        !(task.dependencies ?? []).includes(t.id)
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.category}] {t.title}
                      </option>
                    ))}
                </select>
              )}
            {projTasks.filter((t) => !t.deleted && t.dependencies?.includes(task.id)).length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#E8E8E8]">
                <p className="text-xs text-[#737373] mb-1.5">Blocked by this task:</p>
                {projTasks
                  .filter((t) => !t.deleted && t.dependencies?.includes(task.id))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`tasks/${t.id}`)}
                      className="block text-xs text-[#0038BC] hover:underline truncate w-full text-left py-0.5"
                    >
                      {t.title}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
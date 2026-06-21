import React, { useState, useEffect, useCallback } from "react";
import { useTask } from "../../hooks/useTask.js";
import { useComments } from "../../hooks/useComments.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { MarkdownEditor } from "../editor/MarkdownEditor.js";
import { TimePicker } from "../ui/TimePicker.js";
import { SingleDatePicker } from "../ui/DateRangePicker.js";
import { User, Team, Task, SubTask } from "../../types/index.js";
import {
  ArrowLeft, Users, Clock, MessageSquare, GitMerge, AlertCircle,
  HelpCircle, CheckSquare, Plus, Trash2, CheckCircle2, Circle,
  Pencil, Check, X, Sparkles, Send,
} from "lucide-react";
import DOMPurify from "dompurify";

// ─── Gemini helper ────────────────────────────────────────────────────────────
async function geminiGenerate(prompt: string, token: string | null): Promise<string> {
  if (!token) throw new Error("You must be signed in to use AI generation.");
  const res = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `AI generation failed (${res.status}).`);
  return DOMPurify.sanitize(data.text ?? "");
}

// ─── Inline-editable title ────────────────────────────────────────────────────
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
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="flex-1 text-lg font-semibold text-[#111111] border-b-2 border-[#0038BC] bg-transparent focus:outline-none py-0.5"
        />
        <button onClick={commit} className="p-1 text-green-600 hover:bg-green-50 rounded">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="p-1 text-[#737373] hover:bg-[#F4F4F4] rounded">
          <X className="w-4 h-4" />
        </button>
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

// ─── Sub-task list (fixed) ────────────────────────────────────────────────────
function SubTaskList({
  subTasks,
  onUpdate,
  token,
}: {
  subTasks: SubTask[];
  onUpdate: (sub: SubTask[]) => Promise<void>;
  token: string | null;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const toggle = async (id: string) => {
    setSaving(true);
    const updated = subTasks.map((s) =>
      s.id === id ? { ...s, completed: !s.completed } : s
    );
    await onUpdate(updated);
    setSaving(false);
  };

  const addSub = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const sub: SubTask = {
      id: `sub_${crypto.randomUUID()}`,
      title: newTitle.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await onUpdate([...subTasks, sub]);
    setNewTitle("");
    setAdding(false);
    setSaving(false);
  };

  const deleteS = async (id: string) => {
    setSaving(true);
    await onUpdate(subTasks.filter((s) => s.id !== id));
    setSaving(false);
  };

  const saveEdit = async (id: string) => {
    if (!editVal.trim()) return;
    setSaving(true);
    await onUpdate(subTasks.map((s) => s.id === id ? { ...s, title: editVal.trim() } : s));
    setEditId(null);
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addSub(); }
    if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
  };

  // AI-generate subtask suggestions
  const handleAiSuggest = async () => {
    setAiGenerating(true);
    try {
      const existingTitles = subTasks.map((s) => `- ${s.title}`).join("\n");
      const text = await geminiGenerate(
        `Given these existing sub-tasks for a software development task:\n${existingTitles || "(none yet)"}\n\nSuggest 5 concise, actionable sub-tasks (each under 8 words). Return ONLY a plain list, one per line, no numbers or bullets.`,
        token
      );
      const suggestions = text.split("\n").filter((l) => l.trim()).slice(0, 5);
      const newSubs: SubTask[] = suggestions.map((title) => ({
        id: `sub_${crypto.randomUUID()}`,
        title: title.replace(/^[-*•]\s*/, "").trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      }));
      await onUpdate([...subTasks, ...newSubs]);
    } catch (e: any) {
      alert("AI suggestion failed: " + e.message);
    } finally {
      setAiGenerating(false);
    }
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleAiSuggest}
            disabled={aiGenerating}
            className="flex items-center gap-1 text-xs text-[#EF8F00] hover:text-[#d67f00] font-medium px-2 py-1 bg-[#fef3dc] hover:bg-[#fde8b0] rounded-lg transition-colors disabled:opacity-50"
          >
            {aiGenerating ? (
              <div className="w-3 h-3 border-2 border-[#EF8F00] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            AI suggest
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-[#0038BC] hover:underline font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {subTasks.length > 0 && (
        <div className="w-full h-1.5 bg-[#EEEEEE] rounded-full mb-3">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.round((done / subTasks.length) * 100)}%` }}
          />
        </div>
      )}

      {/* Add input — shown at TOP when adding */}
      {adding && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-[#F7F8FA] border border-[#0038BC]/20 rounded-lg">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Sub-task title… (Enter to add)"
            className="flex-1 bg-transparent text-sm text-[#111111] placeholder:text-[#A0A0A0] focus:outline-none"
          />
          <button
            onClick={addSub}
            disabled={saving || !newTitle.trim()}
            className="p-1.5 bg-[#0038BC] text-white rounded-lg hover:bg-[#002fa3] disabled:opacity-50 transition-colors"
          >
            {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => { setAdding(false); setNewTitle(""); }}
            className="p-1.5 text-[#737373] hover:bg-[#EEEEEE] rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {subTasks.map((s) =>
          editId === s.id ? (
            <div key={s.id} className="flex items-center gap-2 p-1.5 bg-[#F7F8FA] rounded-lg">
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(s.id);
                  if (e.key === "Escape") setEditId(null);
                }}
                className="flex-1 px-2.5 py-1.5 border border-[#0038BC] rounded-lg text-sm focus:outline-none bg-white"
              />
              <button onClick={() => saveEdit(s.id)} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditId(null)} className="p-1 text-[#737373] hover:bg-[#F4F4F4] rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div key={s.id} className="flex items-center gap-2.5 group px-1 py-1 rounded-lg hover:bg-[#F7F8FA] transition-colors">
              <button
                onClick={() => toggle(s.id)}
                disabled={saving}
                className={`shrink-0 transition-colors disabled:opacity-50 ${s.completed ? "text-green-500" : "text-[#D0D0D0] hover:text-[#A0A0A0]"}`}
              >
                {s.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </button>
              <span className={`flex-1 text-sm transition-all ${s.completed ? "line-through text-[#A0A0A0]" : "text-[#525252]"}`}>
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
                  disabled={saving}
                  className="p-1 text-[#A0A0A0] hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        )}

        {subTasks.length === 0 && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-4 border-2 border-dashed border-[#E8E8E8] rounded-lg text-xs text-[#A0A0A0] hover:border-[#0038BC] hover:text-[#0038BC] transition-colors"
          >
            + Add a sub-task
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Comment item (editable) ──────────────────────────────────────────────────
function CommentItem({
  comment,
  currentUserId,
  onEdit,
}: {
  comment: any;
  currentUserId: string;
  onEdit: (id: string, content: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const isOwn = comment.userId === currentUserId;

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    await onEdit(comment.id, draft);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="p-3 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#e8edfb] text-[#0038BC] text-xs font-medium flex items-center justify-center shrink-0">
            {comment.userName.charAt(0)}
          </div>
          <span className="text-sm font-medium text-[#111111]">{comment.userName}</span>
          <span className="text-xs text-[#737373] bg-[#EEEEEE] px-1.5 py-0.5 rounded">
            {comment.userRole}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#A0A0A0]">
            {comment.createdAt?.replace("T", " ").substring(0, 16)}
          </span>
          {isOwn && !editing && (
            <button
              onClick={() => { setDraft(comment.content); setEditing(true); }}
              className="opacity-0 group-hover:opacity-100 p-1 text-[#A0A0A0] hover:text-[#0038BC] hover:bg-[#e8edfb] rounded transition-all"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <MarkdownEditor value={draft} onChange={setDraft} placeholder="Edit comment…" />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" isLoading={saving} onClick={handleSave}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(comment.content); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div
          className="text-sm text-[#525252] prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              DOMPurify.sanitize(comment.content).replace(
                /@(\w+)/g,
                "<span class='text-[#0038BC] font-medium'>@$1</span>"
              )
            ),
          }}
        />
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export function TaskDetailsView({ taskId }: { taskId: string }) {
  const { task, isLoading, error, refresh: reloadTask, updateTask, logHours } = useTask(taskId);
  const { comments, refresh: reloadComments, addComment } = useComments(taskId);
  const token = useUIStore((s) => s.token);
  const user = useUIStore((s) => s.user);
  const navigate = useUIStore((s) => s.navigate);

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projTasks, setProjTasks] = useState<Task[]>([]);

  // Assign
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

  // Description editing
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [descSaving, setDescSaving] = useState(false);

  // AI description
  const [aiDescGenerating, setAiDescGenerating] = useState(false);

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
        <Button onClick={() => navigate("projects")} variant="outline" size="sm" className="mt-3">Back</Button>
      </div>
    );

  const totalLogged = task.timeLogs.reduce((s, l) => s + l.hours, 0);
  const getName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const getTeamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;

  const changeStatus = (v: any) => updateTask({ status: v }).catch((e: any) => alert(e.message));
  const changePriority = (v: any) => updateTask({ priority: v }).catch((e: any) => alert(e.message));
  const changeDueDate = (v: string) => v && updateTask({ dueDate: v }).catch((e: any) => alert(e.message));
  const changeEstHours = (v: string) => {
    const n = parseFloat(v);
    if (!isNaN(n) && n >= 0) updateTask({ estimatedHours: n }).catch((e: any) => alert(e.message));
  };

  const saveTitle = async (title: string) => {
    await updateTask({ title }).catch((e: any) => alert(e.message));
    reloadTask();
  };

  const saveDesc = async () => {
    setDescSaving(true);
    await updateTask({ richTextDesc: DOMPurify.sanitize(descDraft) }).catch((e: any) => alert(e.message));
    setDescSaving(false);
    setEditingDesc(false);
    reloadTask();
  };

  const handleAiDesc = async () => {
    setAiDescGenerating(true);
    try {
      const text = await geminiGenerate(
        `Write a clear, concise task description for a software development task:
Task title: "${task.title}"
Category: ${task.category}
Priority: ${task.priority}

Include: what needs to be done, acceptance criteria, any important notes. 2-3 paragraphs, plain text.`,
        token
      );
      setDescDraft(text);
    } catch (e: any) {
      alert("AI failed: " + e.message);
    } finally {
      setAiDescGenerating(false);
    }
  };

  const saveSubTasks = async (subTasks: SubTask[]) => {
    await updateTask({ subTasks } as any).catch((e: any) => alert(e.message));
    reloadTask();
  };

  // Time log with auto-calc from start/end
  const handleLogHours = async (e: React.FormEvent) => {
    e.preventDefault();
    let h = Number(hours);
    if (logStart && logEnd) {
      const diff =
        new Date(`2000-01-01T${logEnd}`).getTime() -
        new Date(`2000-01-01T${logStart}`).getTime();
      if (diff > 0) h = parseFloat((diff / 3600000).toFixed(2));
    }
    if (!h || h <= 0) { alert("Enter valid hours or pick start/end times."); return; }
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

  // Comment editing — uses a direct API call since useComments doesn't expose edit
  const handleEditComment = async (id: string, content: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: DOMPurify.sanitize(content) }),
      });
      if (res.ok) {
        reloadComments();
      } else {
        reloadComments();
      }
    } catch { reloadComments(); }
  };

  const SEL =
    "px-3 py-1.5 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]";

  const subTasks: SubTask[] = (task as any).subTasks ?? [];

  // Derived: auto-computed hours when start+end selected
  const autoHours = logStart && logEnd ? (() => {
    const diff = new Date(`2000-01-01T${logEnd}`).getTime() - new Date(`2000-01-01T${logStart}`).getTime();
    return diff > 0 ? parseFloat((diff / 3600000).toFixed(2)) : null;
  })() : null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(`projects/${task.projectId}`)}
        className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#111111] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to project
      </button>

      {/* Header */}
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
                {["To Do", "In Progress", "Review", "Done"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#737373] mb-1">Priority</label>
              <select value={task.priority} onChange={(e) => changePriority(e.target.value)} className={SEL}>
                {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-[#737373]" />
                <p className="text-sm font-medium text-[#111111]">Description</p>
              </div>
              <div className="flex items-center gap-2">
                {!editingDesc && (
                  <>
                    <button
                      onClick={async () => {
                        setDescDraft(task.richTextDesc || "");
                        setEditingDesc(true);
                        setAiDescGenerating(true);
                        try {
                          const t = await geminiGenerate(
                            `Write a task description for: "${task.title}" (${task.category}, ${task.priority} priority). 2 paragraphs, plain text.`,
                            token
                          );
                          setDescDraft(t);
                        } catch { }
                        setAiDescGenerating(false);
                      }}
                      className="flex items-center gap-1 text-xs text-[#EF8F00] font-medium px-2 py-1 bg-[#fef3dc] hover:bg-[#fde8b0] rounded-lg transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> AI write
                    </button>
                    <button
                      onClick={() => { setDescDraft(task.richTextDesc || ""); setEditingDesc(true); }}
                      className="flex items-center gap-1 text-xs text-[#737373] hover:text-[#0038BC] hover:bg-[#e8edfb] px-2 py-1 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </>
                )}
              </div>
            </div>
            {editingDesc ? (
              <div className="space-y-3">
                {aiDescGenerating && (
                  <div className="flex items-center gap-2 text-xs text-[#EF8F00]">
                    <div className="w-3 h-3 border-2 border-[#EF8F00] border-t-transparent rounded-full animate-spin" />
                    AI is writing…
                  </div>
                )}
                <MarkdownEditor
                  value={descDraft}
                  onChange={setDescDraft}
                  projectId={task.projectId}
                  placeholder="Describe what needs to be done…"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" isLoading={descSaving} onClick={saveDesc}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingDesc(false)}>Cancel</Button>
                </div>
              </div>
            ) : task.richTextDesc ? (
              <div
                className="prose prose-sm max-w-none text-[#525252]"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(task.richTextDesc) }}
              />
            ) : (
              <button
                onClick={() => { setDescDraft(""); setEditingDesc(true); }}
                className="w-full py-6 border-2 border-dashed border-[#E8E8E8] rounded-xl text-sm text-[#A0A0A0] hover:border-[#0038BC] hover:text-[#0038BC] transition-colors"
              >
                + Add description
              </button>
            )}
          </div>

          {/* Sub-tasks */}
          <SubTaskList subTasks={subTasks} onUpdate={saveSubTasks} token={token} />

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
                      width: `${Math.min(100, task.estimatedHours > 0 ? (totalLogged / task.estimatedHours) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-[#737373]">{totalLogged}h / {task.estimatedHours}h</span>
              </div>
            </div>

            <form onSubmit={handleLogHours} className="space-y-3 pb-4 border-b border-[#F4F4F4] mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Time range pickers */}
                <TimePicker
                  label="Start time"
                  value={logStart}
                  onChange={setLogStart}
                  placeholder="Select start"
                />
                <TimePicker
                  label="End time"
                  value={logEnd}
                  onChange={setLogEnd}
                  placeholder="Select end"
                />
              </div>

              {autoHours !== null && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Auto-calculated: <strong>{autoHours}h</strong> from selected time range
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={autoHours ? "Hours (auto-calculated)" : "Hours (manual)"}
                  type="number"
                  step="0.1"
                  value={autoHours !== null ? String(autoHours) : hours}
                  onChange={(e) => { if (autoHours === null) setHours(e.target.value); }}
                  placeholder="2.5"
                  disabled={autoHours !== null}
                />
                <Input
                  label="Note"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  placeholder="What did you work on?"
                />
              </div>
              <Button type="submit" variant="primary" size="sm">Log time</Button>
            </form>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {task.timeLogs.length > 0 ? (
                task.timeLogs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-2.5 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg">
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
            <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  currentUserId={user?.id ?? ""}
                  onEdit={handleEditComment}
                />
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-[#A0A0A0] text-center py-3">No comments yet. Be the first!</p>
              )}
            </div>
            <form onSubmit={handleComment} className="space-y-2">
              <MarkdownEditor
                value={comment}
                onChange={setComment}
                placeholder="Add a comment… use @mentions"
                projectId={task.projectId}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" isLoading={commBusy}>
                  <Send className="w-3.5 h-3.5" /> Post
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details — inline editable */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <p className="text-sm font-medium text-[#111111] mb-3">Details</p>
            <div className="space-y-0">
              {/* Due date — custom picker */}
              <div className="py-2 border-b border-[#F4F4F4]">
                <p className="text-xs text-[#737373] mb-1.5">Due date</p>
                <SingleDatePicker
                  value={task.dueDate}
                  onChange={changeDueDate}
                  placeholder="Set due date"
                />
              </div>

              {/* Estimated hours */}
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
              <div className={`flex items-start gap-2 p-2 rounded-lg text-xs mb-3 ${mentionResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {mentionResult.msg}
              </div>
            )}
            <div className="space-y-1.5">
              {task.assignees.length > 0 ? (
                task.assignees.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg">
                    <span className="text-sm text-[#525252] truncate">
                      {a.userId ? getName(a.userId) : `@${getTeamName(a.teamId!)}`}
                    </span>
                    <button onClick={() => unassign(a.userId ?? a.teamId!, !!a.teamId)} className="text-xs text-red-600 hover:underline ml-2 shrink-0">
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
                    <div key={depId} className={`flex items-center justify-between p-2 rounded-lg border text-sm ${done ? "bg-green-50 border-green-200" : "bg-[#fef3dc] border-[#EF8F00]/30"}`}>
                      <button onClick={() => navigate(`tasks/${dep.id}`)} className={`truncate text-left text-xs hover:underline ${done ? "text-green-700 line-through" : "text-[#111111]"}`}>
                        {dep.title}
                      </button>
                      <button onClick={() => toggleDep(depId)} className="text-xs text-red-600 hover:underline ml-2 shrink-0">Remove</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#A0A0A0] mb-3">No dependencies.</p>
            )}
            {projTasks.filter((t) => !t.deleted && t.id !== task.id && !(task.dependencies ?? []).includes(t.id)).length > 0 && (
              <select
                onChange={(e) => { if (e.target.value) { toggleDep(e.target.value); (e.target as any).value = ""; } }}
                className="w-full px-2.5 py-1.5 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC] bg-white"
                defaultValue=""
              >
                <option value="">Add dependency…</option>
                {projTasks.filter((t) => !t.deleted && t.id !== task.id && !(task.dependencies ?? []).includes(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>[{t.category}] {t.title}</option>
                ))}
              </select>
            )}
            {projTasks.filter((t) => !t.deleted && t.dependencies?.includes(task.id)).length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#E8E8E8]">
                <p className="text-xs text-[#737373] mb-1.5">Blocked by this task:</p>
                {projTasks.filter((t) => !t.deleted && t.dependencies?.includes(task.id)).map((t) => (
                  <button key={t.id} onClick={() => navigate(`tasks/${t.id}`)} className="block text-xs text-[#0038BC] hover:underline truncate w-full text-left py-0.5">
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
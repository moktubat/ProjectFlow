import React, { useState, useEffect, useRef, useCallback } from "react";
import { useProject } from "../../hooks/useProject.js";
import { useTasks } from "../../hooks/useTasks.js";
import { useUIStore } from "../../store/ui-store.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { SlidePanel } from "../ui/SlidePanel.js";
import { ActivityStream } from "../ActivityStream.js";
import { KanbanBoard } from "../kanban/KanbanBoard.js";
import { MarkdownEditor } from "../editor/MarkdownEditor.js";
import { TaskListBoard } from "../tasklist/TaskListBoard.js";
import { ProjectSprintAnalytics } from "../project/ProjectSprintAnalytics.js";
import { DateRangePicker } from "../ui/DateRangePicker.js";
import { User } from "../../types/index.js";
import { AssigneePicker } from "../AssigneePicker.js";
import { deriveProjectStatus } from "../../lib/project-status.js";
import {
  Plus, Calendar, FileSpreadsheet, Trash2, Paperclip, Users,
  ArrowLeft, TrendingUp, Clock, Download, Settings, Link,
  Copy, Check, AlertCircle, Pencil, X, Sparkles, ImageIcon, Save,
} from "lucide-react";
import DOMPurify from "dompurify";
import { uploadFileToCloudinary } from "@/src/lib/cloudinary-upload.js";
import { generateWithGemini } from "@/src/lib/ai-generate.js";

const SEL = "w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC] focus:ring-2 focus:ring-[#0038BC]/10";

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;
function isImageFile(name: string, url: string): boolean {
  return IMAGE_EXT_RE.test(name) || IMAGE_EXT_RE.test(url);
}

// ─── Inline-editable field ────────────────────────────────────────────────────
function InlineEditText({
  value,
  onSave,
  className = "",
  inputClassName = "",
  placeholder = "Click to edit…",
  as: Tag = "h2",
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  as?: keyof JSX.IntrinsicElements;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    if (!draft.trim() || draft === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
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
          className={`flex-1 bg-transparent border-b-2 border-white focus:outline-none ${inputClassName}`}
          placeholder={placeholder}
        />
        <button onClick={commit} disabled={saving} className="p-1 bg-white/20 hover:bg-white/30 rounded transition-colors">
          {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5 text-white" />}
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="p-1 hover:bg-white/20 rounded transition-colors">
          <X className="w-3.5 h-3.5 text-white/70" />
        </button>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-2 cursor-pointer ${className}`} onClick={() => { setDraft(value); setEditing(true); }}>
      <Tag className="leading-tight">{value || placeholder}</Tag>
      <Pencil className="w-3.5 h-3.5 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
    </div>
  );
}

export function ProjectDetailsView({ projectId }: { projectId: string }) {
  const { project, isLoading: projLoading, error: projError, refresh: reloadProject, updateProject, deleteProject, uploadFile } = useProject(projectId);
  const { tasks, isLoading: tasksLoading, refresh: reloadTasks, refreshSilent, updateTaskStatus } = useTasks(projectId);
  const token = useUIStore((s) => s.token);
  const navigate = useUIStore((s) => s.navigate);

  usePageTitle(
    project ? project.name : "Project",
    project ? `${project.name} — tasks, progress, and team in ProjectFlow.` : undefined
  );

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [detailTab, setDetailTab] = useState<"charter" | "activity">("charter");
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "analytics">("kanban");

  // Panel open states
  const [isTaskPanel, setTaskPanel] = useState(false);
  const [isFilePanel, setFilePanel] = useState(false);
  const [isRosterPanel, setRosterPanel] = useState(false);
  const [lightboxFile, setLightboxFile] = useState<{ url: string; name: string } | null>(null);

  // ── Inline description editing ──
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [descSaving, setDescSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  // ── Inline cover image editing ──
  const [editingCover, setEditingCover] = useState(false);
  const [coverDraft, setCoverDraft] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);

  // Task form
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tStatus, setTStatus] = useState<any>("To Do");
  const [tPri, setTPri] = useState<any>("Medium");
  const [tCat, setTCat] = useState<any>("Development");
  const [tDue, setTDue] = useState("");
  const [tEst, setTEst] = useState("");
  const [tAsgn, setTAsgn] = useState<{ userId?: string; teamId?: string }[]>([]);
  const [tDeps, setTDeps] = useState<{ taskId?: string; userId?: string; teamId?: string; note?: string }[]>([]);
  const [depNote, setDepNote] = useState("");
  const [tErr, setTErr] = useState<string | null>(null);
  const [tBusy, setTBusy] = useState(false);

  // File form
  const [fName, setFName] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fErr, setFErr] = useState<string | null>(null);
  const [fBusy, setFBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Roster / invite
  const [invRole, setInvRole] = useState("DEVELOPER");
  const [invTeam, setInvTeam] = useState("");
  const [copied, setCopied] = useState(false);
  const [editRoles, setEditRoles] = useState<Record<string, string>>({});
  const [editTeams, setEditTeams] = useState<Record<string, string>>({});
  const [savingUser, setSavingUser] = useState<string | null>(null);

  const loadRoster = async () => {
    if (!token) return;
    const [uRes, tRes] = await Promise.all([
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (uRes.ok) {
      const allApproved = (await uRes.json()).filter((u: User) => u.status === "APPROVED");
      setUsers(project ? allApproved.filter((u: User) => project.members?.includes(u.id)) : allApproved);
    }
    if (tRes.ok) setTeams(await tRes.json());
  };

  useEffect(() => { loadRoster(); }, [token, project?.members?.length]);

  const handleBoardTaskUpdate = useCallback((taskId?: string, newStatus?: string) => {
    if (taskId && newStatus) {
      updateTaskStatus(taskId, newStatus);
    } else {
      refreshSilent();
    }
  }, [updateTaskStatus, refreshSilent]);

  if (projLoading) return (
    <div className="flex justify-center py-24">
      <div className="w-7 h-7 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (projError || !project) return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
      <p className="text-sm font-medium text-red-700 mb-1">Failed to load project</p>
      <p className="text-sm text-red-600">{projError}</p>
      <Button onClick={() => navigate("projects")} variant="outline" size="sm" className="mt-3">Back to projects</Button>
    </div>
  );

  const completedTasks = tasks.filter((t) => t.status === "Done").length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const derivedStatus = deriveProjectStatus(tasks);
  const totalLogged = tasks.reduce((s, t) => s + t.timeLogs.reduce((a, l) => a + l.hours, 0), 0);
  const totalEst = tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);

  const exportCSV = () => {
    fetch(`/api/projects/${projectId}/hours/export`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `project_${projectId}_hours.csv`; a.click(); });
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project? All tasks will be moved to trash.")) return;
    try { await deleteProject(); navigate("projects"); } catch (e: any) { alert(e.message); }
  };

  // ── Inline title save ──
  const handleSaveTitle = async (name: string) => {
    await updateProject({ name });
  };

  // ── Inline date save ──
  const handleSaveDates = async (start: string, end: string) => {
    if (!start || !end) return;
    await updateProject({ startDate: start, endDate: end });
  };

  // ── Description editing ──
  const handleSaveDesc = async () => {
    setDescSaving(true);
    await updateProject({ richTextDescription: DOMPurify.sanitize(descDraft) });
    setDescSaving(false);
    setEditingDesc(false);
  };

  // ── AI description via Gemini ──
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const text = await generateWithGemini(
        `Write a professional project description for a software project management tool. 
Project name: "${project.name}"
Additional context: ${aiPrompt}
Write 2-3 clear paragraphs covering objectives, scope, and expected outcomes. Use plain text, no markdown.`,
        token
      );
      setDescDraft(text);
      setShowAiPrompt(false);
      setAiPrompt("");
    } catch (e: any) {
      alert("AI generation failed: " + e.message);
    } finally {
      setAiGenerating(false);
    }
  };

  // ── Cover image ──
  const uploadCoverToCloudinary = async (file: File) => {
    setCoverUploading(true);
    try {
      const data = await uploadFileToCloudinary(file, token);
      setCoverDraft(data.url);
    } catch (e: any) { alert(e.message); }
    finally { setCoverUploading(false); }
  };

  const handleSaveCover = async () => {
    await updateProject({ coverImageUrl: coverDraft });
    setEditingCover(false);
    reloadProject();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim() || !tDue) { setTErr("Title and due date are required."); return; }
    setTBusy(true); setTErr(null);
    try {
      const depsWithNote = tDeps.map((d) => (depNote.trim() ? { ...d, note: depNote.trim() } : d));
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, title: tTitle, richTextDesc: DOMPurify.sanitize(tDesc), status: tStatus, priority: tPri, category: tCat, dueDate: tDue, estimatedHours: Number(tEst) || 0, assignees: tAsgn, dependencies: depsWithNote }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setTaskPanel(false);
      setTTitle(""); setTDesc(""); setTDue(""); setTEst(""); setTAsgn([]); setTDeps([]); setDepNote("");
      reloadTasks();
    } catch (e: any) { setTErr(e.message); }
    finally { setTBusy(false); }
  };

  const uploadToCloudinary = async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    setFName(file.name);
    try {
      const data = await uploadFileToCloudinary(file, token);
      setFUrl(data.url);
      if (data.simulated) setUploadErr("Simulation mode — placeholder URL set.");
    } catch (e: any) { setUploadErr(e.message); }
    finally { setUploading(false); }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fName.trim() || !fUrl.trim()) { setFErr("Name and URL are required."); return; }
    setFBusy(true); setFErr(null);
    try { await uploadFile(fName, fUrl); setFilePanel(false); setFName(""); setFUrl(""); }
    catch (e: any) { setFErr(e.message); }
    finally { setFBusy(false); }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`Remove "${fileName}" from this project?`)) return;
    setDeletingFileId(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}?projectId=${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error || `Failed to delete file (${res.status}).`);
      }
      await reloadProject();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingFileId(null);
    }
  };

  const addToProject = async (uid: string) => {
    if (project.members.includes(uid)) return;
    await fetch(`/api/projects/${projectId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ members: [...project.members, uid] }) });
    reloadProject(); loadRoster();
  };

  const removeFromProject = async (uid: string) => {
    await fetch(`/api/projects/${projectId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ members: project.members.filter((id) => id !== uid) }) });
    reloadProject(); loadRoster();
  };

  const saveUserDetails = async (uid: string, current: User) => {
    setSavingUser(uid);
    await fetch(`/api/users/${uid}/details`, {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: editRoles[uid] ?? current.role, teamId: editTeams[uid] ?? current.teamId ?? "none" }),
    });
    loadRoster();
    setSavingUser(null);
  };

  const inviteUrl = `${window.location.origin}/#/register?invite=true&role=${invRole}${invTeam ? `&teamId=${invTeam}` : ""}`;
  const copyInvite = () => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("projects")} className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#111111] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to projects
      </button>

      {/* Cover hero — everything inline-editable */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <div className="relative h-40 md:h-52 bg-[#111111] group">
          {editingCover ? (
            <div className="absolute inset-0 z-10 bg-black/80 flex flex-col items-center justify-center gap-3 p-4">
              <p className="text-white text-sm font-medium">Update cover image</p>
              <div
                className="border-2 border-dashed border-white/40 rounded-xl p-4 w-full max-w-xs text-center cursor-pointer hover:border-white/70 transition-colors"
                onClick={() => document.getElementById("cover-edit-inp")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadCoverToCloudinary(f); }}
              >
                <input id="cover-edit-inp" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCoverToCloudinary(f); }} />
                {coverUploading ? <p className="text-white/70 text-sm animate-pulse">Uploading…</p> :
                  coverDraft ? <p className="text-green-400 text-sm font-medium">Image ready ✓</p> :
                    <p className="text-white/60 text-sm">Drop or click to upload</p>}
              </div>
              <Input
                value={coverDraft}
                onChange={(e) => setCoverDraft(e.target.value)}
                placeholder="Or paste image URL…"
                className="max-w-xs text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={handleSaveCover} disabled={!coverDraft}>Save</Button>
                <Button size="sm" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={() => setEditingCover(false)}>Cancel</Button>
              </div>
            </div>
          ) : null}

          <img
            src={project.coverImageUrl || "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=800&q=70"}
            alt={project.name}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Edit cover button — top right */}
          {!editingCover && (
            <button
              onClick={() => { setCoverDraft(project.coverImageUrl || ""); setEditingCover(true); }}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/40 hover:bg-black/60 text-white text-xs rounded-lg backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
            >
              <ImageIcon className="w-3 h-3" /> Change cover
            </button>
          )}

          <div className="absolute bottom-4 left-5 right-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="mb-2 max-w-[220px]">
                <DateRangePicker
                  value={{ start: project.startDate, end: project.endDate }}
                  onChange={({ start, end }) => handleSaveDates(start, end)}
                />
              </div>

              {/* Inline-editable title */}
              <InlineEditText
                value={project.name}
                onSave={handleSaveTitle}
                as="h2"
                className="text-white"
                inputClassName="text-xl font-semibold text-white"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border ${derivedStatus === "Done"
                  ? "bg-emerald-500/20 border-emerald-300/40 text-emerald-50"
                  : "bg-white/10 border-white/20 text-white"
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${derivedStatus === "Done" ? "bg-emerald-300" : "bg-[#5B8DEF] motion-safe:animate-pulse"}`} />
                {derivedStatus}
              </span>
              <Button onClick={exportCSV} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
              </Button>
              <button onClick={handleDelete} className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors" title="Delete project">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 divide-x divide-[#E8E8E8] text-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#737373] text-xs"><TrendingUp className="w-3.5 h-3.5" />Progress</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-[#EEEEEE] rounded-full">
                <div className="h-full bg-[#0038BC] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-medium text-[#111111]">{progress}%</span>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#737373] text-xs"><Clock className="w-3.5 h-3.5" />Hours</span>
            <span className="text-sm font-medium text-[#111111]">{totalLogged}h / {totalEst}h</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#737373] text-xs"><Users className="w-3.5 h-3.5" />Members</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#111111]">{project.members?.length ?? 0}</span>
              <button onClick={() => setRosterPanel(true)} className="p-1 bg-[#e8edfb] text-[#0038BC] hover:bg-[#0038BC] hover:text-white rounded transition-colors">
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Description + Files */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
          <div className="flex border-b border-[#E8E8E8]">
            {(["charter", "activity"] as const).map((t) => (
              <button key={t} onClick={() => setDetailTab(t)}
                className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${detailTab === t ? "border-[#0038BC] text-[#0038BC] font-medium" : "border-transparent text-[#737373] hover:text-[#111111]"}`}>
                {t === "charter" ? "Description" : "Activity"}
              </button>
            ))}
          </div>
          <div className="p-4">
            {detailTab === "charter" ? (
              <div>
                {!editingDesc ? (
                  <div className="group">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-[#737373] font-medium uppercase tracking-wide">Project description</p>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setDescDraft(project.richTextDescription || ""); setEditingDesc(true); }}
                          className="flex items-center gap-1 text-xs text-[#737373] hover:text-[#0038BC] hover:bg-[#e8edfb] px-2 py-1 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    </div>
                    {project.richTextDescription ? (
                      <div
                        className="prose prose-sm max-w-none text-[#525252]"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(project.richTextDescription) }}
                      />
                    ) : (
                      <button
                        onClick={() => { setDescDraft(""); setEditingDesc(true); }}
                        className="w-full py-8 border-2 border-dashed border-[#E8E8E8] rounded-xl text-sm text-[#A0A0A0] hover:border-[#0038BC] hover:text-[#0038BC] transition-colors"
                      >
                        + Add project description
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#111111]">Edit description</p>
                      <button
                        onClick={() => setShowAiPrompt(!showAiPrompt)}
                        className="flex items-center gap-1.5 text-xs text-[#EF8F00] hover:text-[#d67f00] font-medium px-2 py-1 bg-[#fef3dc] hover:bg-[#fde8b0] rounded-lg transition-colors"
                      >
                        <Sparkles className="w-3 h-3" /> AI Generate
                      </button>
                    </div>

                    {showAiPrompt && (
                      <div className="p-3 bg-[#fef3dc] border border-[#EF8F00]/20 rounded-xl space-y-2">
                        <p className="text-xs font-medium text-[#9a5b00]">Describe what you want AI to write:</p>
                        <textarea
                          rows={2}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="e.g. A cloud migration project for Q4, moving 3 services to AWS with zero downtime…"
                          className="w-full px-3 py-2 bg-white border border-[#EF8F00]/30 rounded-lg text-sm focus:outline-none focus:border-[#EF8F00] resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setShowAiPrompt(false)}>Cancel</Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            isLoading={aiGenerating}
                            onClick={handleAiGenerate}
                          >
                            <Sparkles className="w-3 h-3" /> Generate
                          </Button>
                        </div>
                      </div>
                    )}

                    <MarkdownEditor
                      value={descDraft}
                      onChange={setDescDraft}
                      projectId={projectId}
                      placeholder="Describe the project goals and scope…"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="primary" isLoading={descSaving} onClick={handleSaveDesc}>
                        <Save className="w-3.5 h-3.5" /> Save description
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingDesc(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ActivityStream projectId={projectId} />
            )}
          </div>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8]">
            <span className="flex items-center gap-1.5 text-sm text-[#111111]">
              <Paperclip className="w-3.5 h-3.5 text-[#737373]" /> Files
            </span>
            <button onClick={() => setFilePanel(true)} className="text-xs text-[#0038BC] hover:underline">+ Add</button>
          </div>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {(project.files ?? []).length > 0 ? project.files.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-2.5 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg">
                <div className="min-w-0 pr-2">
                  <p className="text-sm text-[#111111] truncate">{f.name}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isImageFile(f.name, f.url) ? (
                    <button
                      type="button"
                      onClick={() => setLightboxFile({ url: f.url, name: f.name })}
                      className="flex items-center gap-1 text-xs text-[#0038BC] hover:underline"
                    >
                      <ImageIcon className="w-3 h-3" /> Preview
                    </button>
                  ) : (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#0038BC] hover:underline">
                      <Download className="w-3 h-3" /> Open
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteFile(f.id, f.name)}
                    disabled={deletingFileId === f.id}
                    className="p-1 text-[#A0A0A0] hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Delete file"
                  >
                    {deletingFileId === f.id
                      ? <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            )) : (
              <div className="py-8 text-center">
                <Paperclip className="w-6 h-6 text-[#D0D0D0] mx-auto mb-1.5" />
                <p className="text-xs text-[#A0A0A0]">No files yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Board */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#E8E8E8]">
          <div>
            <p className="text-sm font-medium text-[#111111]">Task board</p>
            <p className="text-xs text-[#737373] mt-0.5">{tasks.length} tasks total</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#F4F4F4] p-0.5 rounded-lg text-xs">
              {(["kanban", "list", "analytics"] as const).map((v) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 rounded-md capitalize transition-colors ${viewMode === v ? "bg-white text-[#111111] shadow-sm font-medium" : "text-[#737373]"}`}>
                  {v === "kanban" ? "Board" : v === "list" ? "List" : "Analytics"}
                </button>
              ))}
            </div>
            <Button onClick={() => setTaskPanel(true)} variant="primary" size="sm">
              <Plus className="w-3.5 h-3.5" /> New task
            </Button>
          </div>
        </div>
        <div className="p-4">
          {tasksLoading && tasks.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {viewMode === "kanban" && (
                <KanbanBoard
                  tasks={tasks}
                  users={users}
                  onTaskUpdated={handleBoardTaskUpdate}
                />
              )}
              {viewMode === "list" && <TaskListBoard tasks={tasks} users={users} onTaskUpdated={handleBoardTaskUpdate} />}
              {viewMode === "analytics" && <ProjectSprintAnalytics tasks={tasks} users={users} project={project} />}
            </>
          )}
        </div>
      </div>

      {/* ── Slide panels ── */}

      {/* New task panel */}
      <SlidePanel isOpen={isTaskPanel} onClose={() => setTaskPanel(false)} title="New task" description={`Project: ${project.name}`} size="lg">
        <form onSubmit={handleCreateTask} className="space-y-4">
          {tErr && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{tErr}
            </div>
          )}
          <Input label="Task title" value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="e.g. Implement auth" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Est. hours" type="number" value={tEst} onChange={(e) => setTEst(e.target.value)} placeholder="4" />
            <Input label="Due date" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              ["Status", tStatus, setTStatus, ["To Do", "In Progress", "Review", "Done"]],
              ["Priority", tPri, setTPri, ["Low", "Medium", "High", "Critical"]],
              ["Category", tCat, setTCat, ["Development", "Design", "QA", "Management", "Billing", "Others"]],
            ] as any[]).map(([lbl, val, set, opts]) => (
              <div key={lbl}>
                <label className="block text-xs text-[#737373] mb-1">{lbl}</label>
                <select value={val} onChange={(e) => set(e.target.value)} className={SEL}>
                  {opts.map((o: string) => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-[#737373] mb-1">Description</label>
            <MarkdownEditor value={tDesc} onChange={setTDesc} projectId={projectId} />
          </div>
          <div>
            <label className="block text-xs text-[#737373] mb-1.5">Assignees</label>
            <AssigneePicker
              users={users}
              teams={teams}
              selected={tAsgn.map((id) => ({ userId: id }))}
              onChange={(next) => setTAsgn(next as any)}
              recentIds={project.recentAssignees}
            />
          </div>
          <div>
            <label className="block text-xs text-[#737373] mb-1.5">Dependencies (person/team blockers)</label>
            <AssigneePicker
              users={users}
              teams={teams}
              selected={tDeps.map((d) => ({ userId: d.userId, teamId: d.teamId }))}
              onChange={(next) => setTDeps(next.map((n) => ({ ...n, note: depNote.trim() || undefined })))}
              recentIds={project.recentAssignees}
            />
            {tDeps.length > 0 && (
              <input
                value={depNote}
                onChange={(e) => setDepNote(e.target.value)}
                placeholder="Optional note — why is this blocked?"
                className="w-full mt-2 px-3 py-2 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8]">
            <Button type="button" variant="outline" onClick={() => setTaskPanel(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={tBusy}>Create task</Button>
          </div>
        </form>
      </SlidePanel>

      {/* Add file panel */}
      <SlidePanel isOpen={isFilePanel} onClose={() => setFilePanel(false)} title="Add file" description="Attach a document or link to this project." size="md">
        <form onSubmit={handleFileSubmit} className="space-y-4">
          {fErr && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{fErr}
            </div>
          )}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadToCloudinary(f); }}
            onClick={() => document.getElementById("file-inp")?.click()}
            className="border-2 border-dashed border-[#D0D0D0] rounded-lg p-6 text-center cursor-pointer hover:border-[#0038BC] transition-colors">
            <input id="file-inp" type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadToCloudinary(f); }} />
            <Paperclip className="w-6 h-6 text-[#A0A0A0] mx-auto mb-2" />
            {uploading ? <p className="text-sm text-[#737373] animate-pulse">Uploading…</p> : fUrl ? <p className="text-sm text-green-600 font-medium">File uploaded ✓</p> : <p className="text-sm text-[#737373]">Drop or click to upload</p>}
            {uploadErr && <p className="text-xs text-[#EF8F00] mt-1">{uploadErr}</p>}
          </div>
          <Input label="File name" value={fName} onChange={(e) => setFName(e.target.value)} required />
          <Input label="File URL" value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://…" required />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8]">
            <Button type="button" variant="outline" onClick={() => setFilePanel(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={fBusy}>Save file</Button>
          </div>
        </form>
      </SlidePanel>

      {/* Team roster panel */}
      <SlidePanel isOpen={isRosterPanel} onClose={() => setRosterPanel(false)} title="Team management" description={`Manage members for ${project.name}`} size="xl">
        <div className="space-y-5">
          <div className="p-4 bg-[#F7F8FA] border border-[#E8E8E8] rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Link className="w-3.5 h-3.5 text-[#0038BC]" />
              <p className="text-sm font-medium text-[#111111]">Invite link</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#737373] mb-1">Role</label>
                <select value={invRole} onChange={(e) => setInvRole(e.target.value)} className={SEL}>
                  {["PROJECT_MANAGER", "TEAM_LEAD", "DEVELOPER", "DESIGNER", "SENIOR", "JUNIOR"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#737373] mb-1">Team</label>
                <select value={invTeam} onChange={(e) => setInvTeam(e.target.value)} className={SEL}>
                  <option value="">No team</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white border border-[#E8E8E8] rounded-lg px-3 py-2">
              <span className="text-xs text-[#737373] truncate flex-1 font-mono">{inviteUrl}</span>
              <button onClick={copyInvite} className="flex items-center gap-1 text-xs text-[#0038BC] font-medium shrink-0 hover:underline">
                {copied ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[#111111] mb-2">Current members ({project.members?.length ?? 0})</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.filter((u) => project.members?.includes(u.id)).map((u) => (
                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-[#E8E8E8] rounded-lg bg-white">
                  <div>
                    <p className="text-sm text-[#111111] font-medium">{u.name}</p>
                    <p className="text-xs text-[#737373]">@{u.username}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={editRoles[u.id] ?? u.role} onChange={(e) => setEditRoles((p) => ({ ...p, [u.id]: e.target.value }))}
                      className="px-2 py-1 border border-[#D0D0D0] rounded-lg text-xs bg-white focus:outline-none">
                      {["PROJECT_MANAGER", "TEAM_LEAD", "DEVELOPER", "DESIGNER", "SENIOR", "JUNIOR"].map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <select value={editTeams[u.id] ?? (u.teamId ?? "none")} onChange={(e) => setEditTeams((p) => ({ ...p, [u.id]: e.target.value }))}
                      className="px-2 py-1 border border-[#D0D0D0] rounded-lg text-xs bg-white focus:outline-none">
                      <option value="none">No team</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <Button size="sm" variant="outline" isLoading={savingUser === u.id} onClick={() => saveUserDetails(u.id, u)}>Save</Button>
                    <button onClick={() => removeFromProject(u.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {users.filter((u) => project.members?.includes(u.id)).length === 0 && (
                <p className="text-sm text-[#A0A0A0] text-center py-4">No members yet.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[#111111] mb-2">Add members</p>
            <div className="max-h-40 overflow-y-auto border border-[#E8E8E8] rounded-lg p-2 grid grid-cols-1 gap-1.5 bg-[#F7F8FA]">
              {users.filter((u) => !project.members?.includes(u.id)).map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2 bg-white border border-[#E8E8E8] rounded-lg">
                  <div>
                    <p className="text-sm text-[#111111] font-medium">{u.name}</p>
                    <p className="text-xs text-[#737373]">@{u.username}</p>
                  </div>
                  <button onClick={() => addToProject(u.id)} className="text-xs text-[#0038BC] hover:underline font-medium">+ Add</button>
                </div>
              ))}
              {users.filter((u) => !project.members?.includes(u.id)).length === 0 && (
                <p className="text-xs text-[#A0A0A0] text-center py-2">All users already added.</p>
              )}
            </div>
          </div>
        </div>
      </SlidePanel>

      {/* Image lightbox */}
      {lightboxFile && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxFile(null)}
        >
          <button
            onClick={() => setLightboxFile(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxFile.url}
              alt={lightboxFile.name}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="flex items-center gap-3">
              <p className="text-sm text-white/80 truncate max-w-xs">{lightboxFile.name}</p>
              <a
                href={lightboxFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-3 h-3" /> Open original
              </a>
            </div>
          </div>
        </div>
      )
      }

    </div >
  );
}
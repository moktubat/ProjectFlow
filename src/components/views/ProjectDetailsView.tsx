import React, { useState, useEffect } from "react";
import { useProject } from "../../hooks/useProject.js";
import { useTasks } from "../../hooks/useTasks.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { Modal } from "../ui/Modal.js";
import { ActivityStream } from "../ActivityStream.js";
import { KanbanBoard } from "../kanban/KanbanBoard.js";
import { TipTapEditor } from "../editor/TipTapEditor.js";
import { ProjectGanttChart } from "../project/ProjectGanttChart.js";
import { ProjectSprintAnalytics } from "../project/ProjectSprintAnalytics.js";
import { User } from "../../types/index.js";
import {
  Plus, Calendar, FileSpreadsheet, Trash2, Paperclip, Users,
  ArrowLeft, TrendingUp, Clock, Download, Settings, Link,
  Copy, Check, AlertCircle,
} from "lucide-react";

const SEL = "w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC] focus:ring-2 focus:ring-[#0038BC]/10";

export function ProjectDetailsView({ projectId }: { projectId: string }) {
  const { project, isLoading: projLoading, error: projError, refresh: reloadProject, deleteProject, uploadFile } = useProject(projectId);
  const { tasks, isLoading: tasksLoading, refresh: reloadTasks } = useTasks(projectId);
  const token = useUIStore((s) => s.token);
  const navigate = useUIStore((s) => s.navigate);

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [detailTab, setDetailTab] = useState<"charter" | "activity">("charter");
  const [viewMode, setViewMode] = useState<"kanban" | "gantt" | "analytics">("kanban");
  const [isTaskModal, setTaskModal] = useState(false);
  const [isFileModal, setFileModal] = useState(false);
  const [isRosterModal, setRosterModal] = useState(false);

  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tStatus, setTStatus] = useState<any>("To Do");
  const [tPri, setTPri] = useState<any>("Medium");
  const [tCat, setTCat] = useState<any>("Development");
  const [tDue, setTDue] = useState("");
  const [tEst, setTEst] = useState("");
  const [tAsgn, setTAsgn] = useState<string[]>([]);
  const [tDeps, setTDeps] = useState<string[]>([]);
  const [tErr, setTErr] = useState<string | null>(null);
  const [tBusy, setTBusy] = useState(false);

  const [fName, setFName] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fCat, setFCat] = useState("Specification");
  const [fErr, setFErr] = useState<string | null>(null);
  const [fBusy, setFBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

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
    if (uRes.ok) setUsers((await uRes.json()).filter((u: User) => u.status === "APPROVED"));
    if (tRes.ok) setTeams(await tRes.json());
  };

  useEffect(() => { loadRoster(); }, [token]);

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

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim() || !tDue) { setTErr("Title and due date are required."); return; }
    setTBusy(true); setTErr(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, title: tTitle, richTextDesc: tDesc, status: tStatus, priority: tPri, category: tCat, dueDate: tDue, estimatedHours: Number(tEst) || 0, assignees: tAsgn.map((id) => ({ userId: id })), dependencies: tDeps }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setTaskModal(false);
      setTTitle(""); setTDesc(""); setTDue(""); setTEst(""); setTAsgn([]); setTDeps([]);
      reloadTasks();
    } catch (e: any) { setTErr(e.message); }
    finally { setTBusy(false); }
  };

  const uploadToCloudinary = async (file: File) => {
    setUploading(true); setUploadErr(null); setFName(file.name);
    try {
      const b64 = await new Promise<string>((ok, rej) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
      const res = await fetch("/api/cloudinary/upload", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ base64Data: b64, filename: file.name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFUrl(data.url);
      if (data.simulated) setUploadErr("Simulation mode — placeholder URL set.");
    } catch (e: any) { setUploadErr(e.message); }
    finally { setUploading(false); }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fName.trim() || !fUrl.trim()) { setFErr("Name and URL are required."); return; }
    setFBusy(true); setFErr(null);
    try { await uploadFile(fName, fUrl, fCat); setFileModal(false); setFName(""); setFUrl(""); setFCat("Specification"); }
    catch (e: any) { setFErr(e.message); }
    finally { setFBusy(false); }
  };

  const addToProject = async (uid: string) => {
    if (project.members.includes(uid)) return;
    const res = await fetch(`/api/projects/${projectId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ members: [...project.members, uid] }) });
    if (res.ok) { reloadProject(); loadRoster(); }
  };

  const removeFromProject = async (uid: string) => {
    const res = await fetch(`/api/projects/${projectId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ members: project.members.filter((id) => id !== uid) }) });
    if (res.ok) { reloadProject(); loadRoster(); }
  };

  const saveUserDetails = async (uid: string, current: User) => {
    setSavingUser(uid);
    const res = await fetch(`/api/users/${uid}/details`, {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: editRoles[uid] ?? current.role, teamId: editTeams[uid] ?? current.teamId ?? "none" }),
    });
    if (res.ok) loadRoster(); else { const d = await res.json(); alert(d.error); }
    setSavingUser(null);
  };

  const inviteUrl = `${window.location.origin}/#/register?invite=true&role=${invRole}${invTeam ? `&teamId=${invTeam}` : ""}`;
  const copyInvite = () => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("projects")} className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#111111] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to projects
      </button>

      {/* Cover hero */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <div className="relative h-40 md:h-48 bg-[#111111]">
          <img
            src={project.coverImageUrl || "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=800&q=70"}
            alt={project.name}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-white">
            <div>
              <p className="text-xs text-white/60 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />{project.startDate} – {project.endDate}
              </p>
              <h2 className="text-lg font-semibold">{project.name}</h2>
            </div>
            <div className="flex items-center gap-2">
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
              <button onClick={() => setRosterModal(true)} className="p-1 bg-[#e8edfb] text-[#0038BC] hover:bg-[#0038BC] hover:text-white rounded transition-colors">
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
            {detailTab === "charter"
              ? <div className="prose prose-sm max-w-none text-[#525252]" dangerouslySetInnerHTML={{ __html: project.richTextDescription || "<p>No description provided.</p>" }} />
              : <ActivityStream projectId={projectId} />}
          </div>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8]">
            <span className="flex items-center gap-1.5 text-sm text-[#111111]">
              <Paperclip className="w-3.5 h-3.5 text-[#737373]" /> Files
            </span>
            <button onClick={() => setFileModal(true)} className="text-xs text-[#0038BC] hover:underline">+ Add</button>
          </div>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {(project.files ?? []).length > 0 ? project.files.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-2.5 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg">
                <div className="min-w-0 pr-2">
                  <p className="text-sm text-[#111111] truncate">{f.name}</p>
                  <p className="text-xs text-[#737373]">{f.category}</p>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#0038BC] hover:underline shrink-0">
                  <Download className="w-3 h-3" /> Open
                </a>
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

      {/* Board */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#E8E8E8]">
          <div>
            <p className="text-sm font-medium text-[#111111]">Task board</p>
            <p className="text-xs text-[#737373] mt-0.5">{tasks.length} tasks total</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#F4F4F4] p-0.5 rounded-lg text-xs">
              {(["kanban", "gantt", "analytics"] as const).map((v) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 rounded-md capitalize transition-colors ${viewMode === v ? "bg-white text-[#111111] shadow-sm font-medium" : "text-[#737373]"}`}>
                  {v === "kanban" ? "Board" : v === "gantt" ? "Gantt" : "Analytics"}
                </button>
              ))}
            </div>
            <Button onClick={() => setTaskModal(true)} variant="primary" size="sm">
              <Plus className="w-3.5 h-3.5" /> New task
            </Button>
          </div>
        </div>
        <div className="p-4">
          {tasksLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {viewMode === "kanban" && <KanbanBoard tasks={tasks} users={users} onTaskUpdated={() => { reloadProject(); reloadTasks(); }} />}
              {viewMode === "gantt" && <ProjectGanttChart tasks={tasks} users={users} project={project} onTaskUpdated={() => { reloadProject(); reloadTasks(); }} />}
              {viewMode === "analytics" && <ProjectSprintAnalytics tasks={tasks} users={users} project={project} />}
            </>
          )}
        </div>
      </div>

      {/* Create task modal */}
      <Modal isOpen={isTaskModal} onClose={() => setTaskModal(false)} title="New task" size="lg">
        <form onSubmit={handleCreateTask} className="space-y-4">
          {tErr && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{tErr}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Task title" value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="e.g. Implement auth" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Est. hours" type="number" value={tEst} onChange={(e) => setTEst(e.target.value)} placeholder="4" />
              <Input label="Due date" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([["Status", tStatus, setTStatus, ["To Do","In Progress","Review","Done"]], ["Priority", tPri, setTPri, ["Low","Medium","High","Critical"]], ["Category", tCat, setTCat, ["Development","Design","QA","Management","Billing","Others"]]] as any[]).map(([lbl, val, set, opts]) => (
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
            <TipTapEditor value={tDesc} onChange={setTDesc} projectId={projectId} />
          </div>
          <div>
            <label className="block text-xs text-[#737373] mb-1.5">Assignees</label>
            <div className="max-h-28 overflow-y-auto border border-[#E8E8E8] rounded-lg p-2 grid grid-cols-2 gap-1.5 bg-[#F7F8FA]">
              {users.map((u) => {
                const sel = tAsgn.includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => setTAsgn((p) => sel ? p.filter((x) => x !== u.id) : [...p, u.id])}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left border transition-colors ${sel ? "bg-[#e8edfb] border-[#0038BC]/20 text-[#0038BC]" : "bg-white border-[#E8E8E8] text-[#525252] hover:bg-[#F4F4F4]"}`}>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-[#0038BC] border-[#0038BC]" : "border-[#D0D0D0]"}`}>
                      {sel && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="truncate text-xs">{u.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {tasks.filter((t) => !t.deleted).length > 0 && (
            <div>
              <label className="block text-xs text-[#737373] mb-1.5">Dependencies</label>
              <div className="max-h-24 overflow-y-auto border border-[#E8E8E8] rounded-lg p-2 grid grid-cols-2 gap-1.5 bg-[#F7F8FA]">
                {tasks.filter((t) => !t.deleted).map((t) => {
                  const sel = tDeps.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => setTDeps((p) => sel ? p.filter((x) => x !== t.id) : [...p, t.id])}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left border transition-colors ${sel ? "bg-[#fef3dc] border-[#EF8F00]/20" : "bg-white border-[#E8E8E8] hover:bg-[#F4F4F4]"}`}>
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-[#EF8F00] border-[#EF8F00]" : "border-[#D0D0D0]"}`}>
                        {sel && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="truncate">{t.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8]">
            <Button type="button" variant="outline" onClick={() => setTaskModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={tBusy}>Create task</Button>
          </div>
        </form>
      </Modal>

      {/* File modal */}
      <Modal isOpen={isFileModal} onClose={() => setFileModal(false)} title="Add file">
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
            {uploading ? <p className="text-sm text-[#737373] animate-pulse">Uploading…</p> : <p className="text-sm text-[#737373]">Drop or click to upload</p>}
            {uploadErr && <p className="text-xs text-[#EF8F00] mt-1">{uploadErr}</p>}
          </div>
          <Input label="File name" value={fName} onChange={(e) => setFName(e.target.value)} required />
          <Input label="File URL" value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://…" required />
          <div>
            <label className="block text-xs text-[#737373] mb-1">Category</label>
            <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={SEL}>
              {["Specification","Cover Photo","Mockup / Figma","Billing / Invoice","Client Contract"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8]">
            <Button type="button" variant="outline" onClick={() => setFileModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={fBusy}>Save file</Button>
          </div>
        </form>
      </Modal>

      {/* Roster modal */}
      <Modal isOpen={isRosterModal} onClose={() => setRosterModal(false)} title="Team management" size="lg">
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
                  {["PROJECT_MANAGER","TEAM_LEAD","DEVELOPER","DESIGNER","SENIOR","JUNIOR"].map((r) => <option key={r} value={r}>{r}</option>)}
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
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {users.filter((u) => project.members?.includes(u.id)).map((u) => (
                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-[#E8E8E8] rounded-lg bg-white">
                  <div>
                    <p className="text-sm text-[#111111]">{u.name}</p>
                    <p className="text-xs text-[#737373]">@{u.username}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={editRoles[u.id] ?? u.role} onChange={(e) => setEditRoles((p) => ({ ...p, [u.id]: e.target.value }))}
                      className="px-2 py-1 border border-[#D0D0D0] rounded-lg text-xs bg-white focus:outline-none">
                      {["PROJECT_MANAGER","TEAM_LEAD","DEVELOPER","DESIGNER","SENIOR","JUNIOR"].map((r) => <option key={r}>{r}</option>)}
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
            <div className="max-h-32 overflow-y-auto border border-[#E8E8E8] rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-[#F7F8FA]">
              {users.filter((u) => !project.members?.includes(u.id)).map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2 bg-white border border-[#E8E8E8] rounded-lg">
                  <div>
                    <p className="text-sm text-[#111111]">{u.name}</p>
                    <p className="text-xs text-[#737373]">@{u.username}</p>
                  </div>
                  <button onClick={() => addToProject(u.id)} className="text-xs text-[#0038BC] hover:underline">+ Add</button>
                </div>
              ))}
              {users.filter((u) => !project.members?.includes(u.id)).length === 0 && (
                <p className="text-xs text-[#A0A0A0] text-center py-2 col-span-full">All users already added.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#E8E8E8]">
            <Button onClick={() => setRosterModal(false)} variant="primary">Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
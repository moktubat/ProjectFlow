import React, { useState, useEffect } from "react";
import { useProjects } from "../../hooks/useProjects.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { Modal } from "../ui/Modal.js";
import { TipTapEditor } from "../editor/TipTapEditor.js";
import { Project, User, UserStatus } from "../../types/index.js";
import { FolderKanban, Plus, Calendar, Users, ChevronRight, AlertCircle, Paperclip } from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-[#F4F4F4] text-[#737373]",
  Medium: "bg-[#fef3dc] text-[#9a5b00]",
  High: "bg-orange-50 text-orange-700",
  Critical: "bg-red-50 text-red-700",
};
const STATUS_STYLES: Record<string, string> = {
  Planning: "bg-[#F4F4F4] text-[#737373]",
  "In Progress": "bg-[#e8edfb] text-[#0038BC]",
  Review: "bg-[#fef3dc] text-[#9a5b00]",
  Completed: "bg-green-50 text-green-700",
};

export function ProjectsView() {
  const { projects, isLoading, error, refresh, createProject } = useProjects();
  const token = useUIStore((s) => s.token);
  const user = useUIStore((s) => s.user);
  const navigate = useUIStore((s) => s.navigate);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);

  const [projName, setProjName] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState<any>("Medium");
  const [status, setStatus] = useState<any>("Planning");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cloudinaryError, setCloudinaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((list) => setUsersList(list.filter((u: User) => u.status === UserStatus.APPROVED)))
      .catch(() => { });
  }, [token]);

  const toggleMember = (id: string) =>
    setSelectedMembers((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const uploadCover = async (file: File) => {
    setIsUploading(true);
    setCloudinaryError(null);
    try {
      const reader = new FileReader();
      const b64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const r = await fetch("/api/cloudinary/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64Data: b64, filename: file.name }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setCoverUrl(data.url);
      if (data.simulated) setCloudinaryError("Running in simulation mode — placeholder image assigned.");
    } catch (err: any) {
      setCloudinaryError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !desc.trim() || !startDate || !endDate) {
      setFormError("Project name, description, and dates are required.");
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await createProject({
        name: projName,
        coverImageUrl: coverUrl || "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&q=80&w=600",
        richTextDescription: desc,
        startDate, endDate, priority, status,
        members: selectedMembers.length ? selectedMembers : user ? [user.id] : [],
      });
      setProjName(""); setCoverUrl(""); setDesc(""); setStartDate(""); setEndDate("");
      setPriority("Medium"); setStatus("Planning"); setSelectedMembers([]);
      setIsModalOpen(false);
      refresh();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-xl border border-[#E8E8E8] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Projects</h2>
          <p className="text-sm text-[#737373] mt-0.5">Manage workspaces, deadlines, and teams</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} variant="primary">
          <Plus className="w-4 h-4" />
          New project
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((proj) => (
            <button
              key={proj.id}
              onClick={() => navigate(`projects/${proj.id}`)}
              className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden hover:border-[#0038BC]/30 hover:shadow-md transition-all text-left group"
            >
              {/* Cover */}
              <div className="h-32 relative overflow-hidden bg-[#EEEEEE]">
                <img
                  src={proj.coverImageUrl || "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&q=80&w=600"}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <h3 className="text-sm font-semibold text-white truncate pr-2">{proj.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium shrink-0 ${STATUS_STYLES[proj.status] || "bg-[#F4F4F4] text-[#737373]"}`}>
                    {proj.status}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <p className="text-sm text-[#737373] line-clamp-2 mb-3">
                  {proj.richTextDescription.replace(/<[^>]*>/g, "") || "No description."}
                </p>
                <div className="flex items-center justify-between text-xs text-[#A0A0A0]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {proj.startDate} – {proj.endDate}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md ${PRIORITY_STYLES[proj.priority] || "bg-[#F4F4F4] text-[#737373]"}`}>
                    {proj.priority}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 bg-[#F7F8FA] border-t border-[#E8E8E8] flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-[#737373]">
                  <Users className="w-3.5 h-3.5" />
                  {proj.members?.length || 0} members
                </span>
                <span className="flex items-center gap-0.5 text-xs text-[#0038BC] font-medium group-hover:gap-1.5 transition-all">
                  Open <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}

          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 border-2 border-dashed border-[#E8E8E8] rounded-xl">
              <FolderKanban className="w-10 h-10 text-[#D0D0D0] mb-3" />
              <p className="font-medium text-[#525252]">No projects yet</p>
              <p className="text-sm text-[#A0A0A0] mt-1">Create your first project to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Create project modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New project" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <Input id="proj-title" label="Project name" placeholder="e.g. Q4 Cloud Migration" value={projName} onChange={(e) => setProjName(e.target.value)} required />
              <Input id="proj-cover" label="Cover image URL (optional)" placeholder="https://…" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
            </div>

            {/* Cover upload */}
            <div>
              <label className="block text-sm font-medium text-[#3D3D3D] mb-1">Upload cover</label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadCover(f); }}
                onClick={() => document.getElementById("cover-upload-proj")?.click()}
                className="border-2 border-dashed border-[#D0D0D0] rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer hover:border-[#0038BC] transition-colors"
              >
                <input id="cover-upload-proj" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
                <Paperclip className="w-5 h-5 text-[#A0A0A0] mb-1" />
                {isUploading ? (
                  <span className="text-xs text-[#737373] animate-pulse">Uploading…</span>
                ) : (
                  <span className="text-xs text-[#737373]">Drop or click to upload</span>
                )}
              </div>
              {cloudinaryError && <p className="text-xs text-[#EF8F00] mt-1">{cloudinaryError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input id="proj-start" label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <Input id="proj-end" label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="proj-status" className="block text-sm font-medium text-[#3D3D3D] mb-1">Status</label>
              <select id="proj-status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]">
                {["Planning", "In Progress", "Review", "Completed"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="proj-priority" className="block text-sm font-medium text-[#3D3D3D] mb-1">Priority</label>
              <select id="proj-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]">
                {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3D3D3D] mb-1">Description</label>
            <TipTapEditor value={desc} onChange={setDesc} placeholder="Describe the project goals and scope…" />
          </div>

          {/* Member selection */}
          <div>
            <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Add team members</label>
            <div className="max-h-36 overflow-y-auto border border-[#E8E8E8] rounded-lg bg-[#F7F8FA] p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {usersList.map((u) => {
                const sel = selectedMembers.includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => toggleMember(u.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${sel ? "bg-[#e8edfb] text-[#0038BC] border border-[#0038BC]/20" : "bg-white border border-[#E8E8E8] text-[#3D3D3D] hover:bg-[#F4F4F4]"}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-[#0038BC] border-[#0038BC]" : "border-[#D0D0D0]"}`}>
                      {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="truncate">{u.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E8E8E8]">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>Create project</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
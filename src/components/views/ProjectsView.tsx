import React, { useState, useEffect } from "react";
import { useProjects } from "../../hooks/useProjects.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { Modal } from "../ui/Modal.js";
import { TipTapEditor } from "../editor/TipTapEditor.js";
import { Project, Role, User, UserStatus } from "../../types/index.js";
import { 
  FolderKanban, 
  Plus, 
  Calendar, 
  Award, 
  CheckCircle2, 
  ChevronRight, 
  ShieldAlert, 
  Users,
  Paperclip 
} from "lucide-react";

export function ProjectsView() {
  const { projects, isLoading, error, refresh, createProject } = useProjects();
  const token = useUIStore((state) => state.token);
  const user = useUIStore((state) => state.user);
  const navigate = useUIStore((state) => state.navigate);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);

  // Setup form states
  const [projName, setProjName] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [status, setStatus] = useState<"Planning" | "In Progress" | "Review" | "Completed">("Planning");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load corporate members directory for assignment
  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return;
      try {
        const res = await fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const list = await res.json();
          // Only permit approved users to belong to teams
          setUsersList(list.filter((u: User) => u.status === UserStatus.APPROVED));
        }
      } catch (err) {
        console.warn("Could not load users directory:", err);
      }
    };
    fetchUsers();
  }, [token]);

  // Handle Multi-Select Members toggles
  const handleToggleMember = (uId: string) => {
    setSelectedMembers((prev) => 
      prev.includes(uId) ? prev.filter((id) => id !== uId) : [...prev, uId]
    );
  };

  const [isUploading, setIsUploading] = useState(false);
  const [cloudinaryError, setCloudinaryError] = useState<string | null>(null);

  const handleFileChangeAndUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFileToCloudinary(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFileToCloudinary(file);
  };

  const uploadFileToCloudinary = async (file: File) => {
    setIsUploading(true);
    setCloudinaryError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const res = await fetch("/api/cloudinary/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          base64Data,
          filename: file.name
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload file.");
      }
      setCoverUrl(data.url);
      if (data.simulated) {
        setCloudinaryError("Offline simulation bounds. Dummy placeholder cover assigned.");
      }
    } catch (err: any) {
      setCloudinaryError(err.message || "Failed uploading file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !desc.trim() || !startDate || !endDate) {
      setFormError("Project Name, Rich Description, Start/End dates are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await createProject({
        name: projName,
        coverImageUrl: coverUrl || "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&q=80&w=600",
        richTextDescription: desc,
        startDate,
        endDate,
        priority,
        status,
        members: selectedMembers.length > 0 ? selectedMembers : (user ? [user.id] : [])
      });

      // Clear form
      setProjName("");
      setCoverUrl("");
      setDesc("");
      setStartDate("");
      setEndDate("");
      setPriority("Medium");
      setStatus("Planning");
      setSelectedMembers([]);

      setIsModalOpen(false);
      refresh();
    } catch (err: any) {
      setFormError(err.message || "Failed to finalize project workspace.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if logged-in user can create a project - everyone is admin-like inside their envs
  const canCreate = true;

  const getPriorityBadgeColors = (p: string) => {
    switch (p) {
      case "Low": return "bg-slate-100 text-slate-700";
      case "Medium": return "bg-amber-50 text-amber-700 border-amber-200";
      case "High": return "bg-orange-50 text-orange-700 border-orange-200";
      case "Critical": return "bg-pink-50 text-theme-pink border border-pink-200 animate-pulse";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusBadgeColors = (st: string) => {
    switch (st) {
      case "Planning": return "bg-slate-100 text-slate-700";
      case "In Progress": return "bg-sky-50 text-sky-700 border border-sky-200";
      case "Review": return "bg-amber-50 text-theme-yellow border border-amber-200";
      case "Completed": return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      
      {/* Portfolio Header Column */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Projects Portfolio</h2>
          <p className="text-slate-500 text-xs mt-1">Configure company workspaces, track deadlines, and assemble staffing teams</p>
        </div>
        {canCreate && (
          <div className="mt-4 sm:mt-0">
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="primary"
              className="inline-flex items-center space-x-1.5 font-sans"
            >
              <Plus className="w-4 h-4" />
              <span>Assemble Project Workspace</span>
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-purple mx-auto mb-2" />
          <span className="text-xs text-slate-400 font-medium">Downloading company records...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-pink-50 border border-pink-100 rounded-xl text-slate-700 text-xs font-semibold">
          Error: {error}
        </div>
      ) : (
        /* Projects Visual Bento Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => navigate(`projects/${proj.id}`)}
              className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden cursor-pointer hover:border-slate-300 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between group h-[300px]"
            >
              {/* Cover Photo Backdrop */}
              <div className="h-28 relative overflow-hidden bg-slate-100">
                <img
                  src={proj.coverImageUrl || "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&q=80&w=600"}
                  alt={proj.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 duration-300 transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-transparent" />
                
                {/* Meta Labels */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
                  <h3 className="font-bold text-sm truncate pr-4 font-display leading-tight">{proj.name}</h3>
                  <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded-full ${getStatusBadgeColors(proj.status)}`}>
                    {proj.status}
                  </span>
                </div>
              </div>

              {/* Specs info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                
                {/* Description snippet */}
                <div className="text-xs text-slate-500 leading-relaxed font-sans mb-3 line-clamp-2">
                  {proj.richTextDescription.replace(/<[^>]*>/g, "") || "No descriptive details entered for workspace portfolio."}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono font-medium text-slate-400 mb-2">
                  {/* Start / End Duration block */}
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{proj.startDate} to {proj.endDate}</span>
                  </div>

                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getPriorityBadgeColors(proj.priority)}`}>
                    {proj.priority}
                  </span>
                </div>
              </div>

              {/* Card Footer Roster Indicator */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-semibold font-mono">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{proj.members?.length || 0} Member(s)</span>
                </div>
                <div className="text-xs text-theme-teal font-bold flex items-center space-x-0.5 group-hover:translate-x-1 duration-200 transition-transform font-display">
                  <span>Enter Workspace</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

            </div>
          ))}

          {projects.length === 0 && (
            <div className="col-span-full border-2 border-dashed border-slate-200 rounded-2xl py-24 text-center">
              <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">Workspace portfolio is completely clear</p>
              <p className="text-xs text-slate-400 mt-1 italic max-w-sm mx-auto p-4 pl-6">
                Assemble high performance spaces using the creation buttons above as Admin/Project Manager.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Assemble Project Dialog Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assemble Project Workspace" size="lg">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-pink-50 border border-pink-100 rounded-lg text-theme-pink text-xs font-semibold flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col justify-between space-y-4">
              <Input
                id="proj-title"
                label="Project Title"
                placeholder="e.g. Q4 Cloud Migration"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                required
              />
              <Input
                id="proj-cover"
                label="Cover Image URL link (Optional)"
                placeholder="https://images.unsplash.com/..."
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
              />
            </div>

            {/* Cloudinary Visual Drag and Drop */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 px-1">
                Upload Cover Photo
              </label>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById("cover-file-upload")?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-theme-teal rounded-xl p-4 text-center cursor-pointer bg-slate-50 hover:bg-slate-50/50 transition-all flex flex-col items-center justify-center space-y-2 group h-[134px]"
              >
                <input
                  id="cover-file-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChangeAndUpload}
                />
                <Paperclip className="w-6 h-6 text-slate-400 group-hover:text-theme-teal group-hover:scale-110 duration-200 transition-all" />
                {isUploading ? (
                  <span className="text-xs font-medium text-slate-500 animate-pulse">Uploading cover...</span>
                ) : (
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-700 block">Drag & drop cover or <span className="text-theme-teal underline group-hover:text-theme-teal/85">browse</span></span>
                    <span className="text-[9px] text-slate-400 block font-sans">Ideal: 16:9 Landscape ratios</span>
                  </div>
                )}
              </div>
              {cloudinaryError && (
                <p className="text-[9px] text-amber-600 font-semibold mt-1 px-1">{cloudinaryError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="proj-start"
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              id="proj-end"
              label="End target Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="proj-status" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
                Project Current Status
              </label>
              <select
                id="proj-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-theme-teal focus:ring-1 focus:ring-teal-400"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label htmlFor="proj-priority" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
                Workspace Urgency Priority
              </label>
              <select
                id="proj-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-theme-teal focus:ring-1 focus:ring-teal-400"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Rich text desc */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 px-1">
              Project Statement Description
            </label>
            <TipTapEditor
              value={desc}
              onChange={setDesc}
              placeholder="State targets, cover links, specs description..."
            />
          </div>

          {/* Multi select project members */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 px-1">
              Assign Team Members (Approved staff Roster)
            </label>
            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50">
              {usersList.map((usr) => {
                const isSelected = selectedMembers.includes(usr.id);
                return (
                  <button
                    key={usr.id}
                    type="button"
                    onClick={() => handleToggleMember(usr.id)}
                    className={`flex items-center space-x-2.5 p-2 rounded-lg text-left transition-all text-xs font-medium border ${
                      isSelected
                        ? "bg-teal-50 border-theme-teal text-theme-teal font-bold shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected ? "border-theme-teal bg-theme-teal text-white" : "border-slate-300"
                    }`}>
                      {isSelected && <Award className="w-2.5 h-2.5" />}
                    </div>
                    <span className="truncate pr-1">{usr.name} (@{usr.username})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel Setup
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Launch Workspace
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useProject } from "../../hooks/useProject.js";
import { useTasks } from "../../hooks/useTasks.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { ActivityStream } from "../ActivityStream.js";
import { Input } from "../ui/Input.js";
import { Modal } from "../ui/Modal.js";
import { KanbanBoard } from "../kanban/KanbanBoard.js";
import { TipTapEditor } from "../editor/TipTapEditor.js";
import { ProjectGanttChart } from "../project/ProjectGanttChart.js";
import { ProjectSprintAnalytics } from "../project/ProjectSprintAnalytics.js";
import { User, Role } from "../../types/index.js";
import { 
  Plus, 
  Calendar, 
  FileSpreadsheet, 
  Trash2, 
  Paperclip, 
  Users, 
  ArrowLeft, 
  TrendingUp, 
  Clock, 
  ShieldAlert, 
  Download,
  Flame,
  CheckCircle,
  Clock3,
  Settings,
  Link,
  Copy,
  Check
} from "lucide-react";

interface ProjectDetailsViewProps {
  projectId: string;
}

export function ProjectDetailsView({ projectId }: ProjectDetailsViewProps) {
  const { project, isLoading: isProjLoading, error: projError, refresh: reloadProject, deleteProject, uploadFile } = useProject(projectId);
  const { tasks, isLoading: isTasksLoading, refresh: reloadTasks } = useTasks(projectId);

  const token = useUIStore((state) => state.token);
  const user = useUIStore((state) => state.user);
  const navigate = useUIStore((state) => state.navigate);

  const [usersList, setUsersList] = useState<User[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"charter" | "activities">("charter");
  const [viewMode, setViewMode] = useState<"kanban" | "gantt" | "analytics">("kanban");

  // Task creation states
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskStatus, setTaskStatus] = useState<"To Do" | "In Progress" | "Review" | "Done">("To Do");
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [taskCategory, setTaskCategory] = useState<any>("Development");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskEstimate, setTaskEstimate] = useState("");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [taskDependencies, setTaskDependencies] = useState<string[]>([]);
  
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);

  // File Upload states
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileCat, setFileCat] = useState("Specification");
  const [fileError, setFileError] = useState<string | null>(null);
  const [isFileSubmitting, setIsFileSubmitting] = useState(false);

  // Cloudinary upload helper states
  const [isUploadingToCloudinary, setIsUploadingToCloudinary] = useState(false);
  const [cloudinaryError, setCloudinaryError] = useState<string | null>(null);

  // Roster and invitation setup states
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [isCreatingNewTeamInline, setIsCreatingNewTeamInline] = useState(false);
  const [newTeamInlineName, setNewTeamInlineName] = useState("");
  const [newTeamInlineDesc, setNewTeamInlineDesc] = useState("");
  const [isAligningUser, setIsAligningUser] = useState<string | null>(null);
  
  // Custom states for invitation links
  const [selectedInviteRole, setSelectedInviteRole] = useState("DEVELOPER");
  const [selectedInviteTeamId, setSelectedInviteTeamId] = useState("");
  const [isInviteCopied, setIsInviteCopied] = useState(false);
  
  // Inline dropdown selection caches
  const [editingUserRoles, setEditingUserRoles] = useState<{[userId: string]: string}>({});
  const [editingUserTeams, setEditingUserTeams] = useState<{[userId: string]: string}>({});

  const fetchRosterData = async () => {
    if (!token) return;
    try {
      const [uRes, tRes] = await Promise.all([
        fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (uRes.ok) {
        const list = await uRes.json();
        setUsersList(list.filter((u: User) => u.status === "APPROVED"));
      }
      if (tRes.ok) {
        setTeamsList(await tRes.json());
      }
    } catch (err) {
      console.warn("Could not load roster data:", err);
    }
  };

  useEffect(() => {
    fetchRosterData();
  }, [token]);

  const handleAddUserToProject = async (userId: string) => {
    if (!project) return;
    const currentMembers = project.members || [];
    if (currentMembers.includes(userId)) return;
    
    const updatedMembers = [...currentMembers, userId];
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ members: updatedMembers })
      });
      if (res.ok) {
        await reloadProject();
        await fetchRosterData();
      }
    } catch (err) {
      console.warn("Error adding user to project:", err);
    }
  };

  const handleRemoveUserFromProject = async (userId: string) => {
    if (!project) return;
    const currentMembers = project.members || [];
    const updatedMembers = currentMembers.filter(id => id !== userId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ members: updatedMembers })
      });
      if (res.ok) {
        await reloadProject();
        await fetchRosterData();
      }
    } catch (err) {
      console.warn("Error removing user from project:", err);
    }
  };

  const handleUpdateUserRosterDetails = async (userId: string, usrObj: User) => {
    const roleToSet = editingUserRoles[userId] || usrObj.role;
    const teamToSet = editingUserTeams[userId] || (usrObj.teamId || "none");
    
    setIsAligningUser(userId);
    try {
      const res = await fetch(`/api/users/${userId}/details`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: roleToSet,
          teamId: teamToSet
        })
      });
      if (res.ok) {
        await fetchRosterData();
        alert(`Details saved for user.`);
      } else {
        const d = await res.json();
        alert("Error saving Details: " + d.error);
      }
    } catch (err) {
      console.warn("Error setting user details:", err);
    } finally {
      setIsAligningUser(null);
    }
  };

  const handleCreateTeamInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamInlineName.trim()) return;
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newTeamInlineName,
          description: newTeamInlineDesc,
          leadId: user?.id || ""
        })
      });
      if (res.ok) {
        const newTeam = await res.json();
        setNewTeamInlineName("");
        setNewTeamInlineDesc("");
        setIsCreatingNewTeamInline(false);
        await fetchRosterData();
        setSelectedInviteTeamId(newTeam.id);
      }
    } catch (err) {
      console.warn("Error creating inline team:", err);
    }
  };

  if (isProjLoading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-purple mx-auto mb-2" />
        <span className="text-xs text-slate-400 font-medium">Downloading project workspace...</span>
      </div>
    );
  }

  if (projError || !project) {
    return (
      <div className="p-6 bg-pink-50 border border-pink-100 rounded-2xl text-theme-pink space-y-4">
        <h3 className="font-bold">Error Accessing Workspace</h3>
        <p className="text-xs">{projError || "Project could not be loaded."}</p>
        <Button onClick={() => navigate("projects")} variant="outline" size="sm">
          Return to portfolio
        </Button>
      </div>
    );
  }

  // Calculate project metrics
  const completedTasks = tasks.filter(t => t.status === "Done").length;
  const progressRatio = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  
  const totalWorked = tasks.reduce((sum, task) => {
    return sum + task.timeLogs.reduce((s, log) => s + log.hours, 0);
  }, 0);

  const totalEstimate = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

  // Triggers CSV Hours export to local browser
  const handleExportCSV = () => {
    if (!token) return;
    window.open(`/api/projects/${projectId}/hours/export?authorization=${token}`, "_blank");
    // Standard fetch download fallback if blockages exist:
    const link = document.createElement("a");
    link.href = `/api/projects/${projectId}/hours/export`;
    link.setAttribute("download", `project_${projectId}_hours.csv`);
    // Add bearer headers through fetch:
    fetch(`/api/projects/${projectId}/hours/export`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleDeleteProjectWorkspace = async () => {
    if (!confirm("Caution: This will permanently delete this project work environment, including its files and tasks Kanban board sheets! Confirm?")) return;
    try {
      await deleteProject();
      navigate("projects");
    } catch (err: any) {
      alert(`Error deleting workspace: ${err.message}`);
    }
  };

  const openNewTaskModal = () => {
    setTaskTitle("");
    setTaskDesc("");
    setTaskStatus("To Do");
    setTaskPriority("Medium");
    setTaskCategory("Development");
    setTaskDueDate("");
    setTaskEstimate("");
    setTaskAssignees([]);
    setTaskDependencies([]);
    setTaskError(null);
    setIsTaskModalOpen(true);
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskCategory || !taskDueDate) {
      setTaskError("Please supply Task Title, Category group, and Due Date.");
      return;
    }

    setIsTaskSubmitting(true);
    setTaskError(null);

    const assigneesFormatted = taskAssignees.map(id => ({ userId: id }));

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          title: taskTitle,
          richTextDesc: taskDesc,
          status: taskStatus,
          priority: taskPriority,
          category: taskCategory,
          dueDate: taskDueDate,
          estimatedHours: Number(taskEstimate) || 0,
          assignees: assigneesFormatted,
          dependencies: taskDependencies
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to finalize task sheet.");
      }

      // Reset
      setTaskTitle("");
      setTaskDesc("");
      setTaskStatus("To Do");
      setTaskPriority("Medium");
      setTaskCategory("Development");
      setTaskDueDate("");
      setTaskEstimate("");
      setTaskAssignees([]);
      setTaskDependencies([]);

      setIsTaskModalOpen(false);
      reloadTasks(); // Refresh board
    } catch (err: any) {
      setTaskError(err.message || "An unexpected error occurred.");
    } finally {
      setIsTaskSubmitting(false);
    }
  };

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim() || !fileUrl.trim()) {
      setFileError("Document name and download link are required.");
      return;
    }

    setIsFileSubmitting(true);
    setFileError(null);

    try {
      await uploadFile(fileName, fileUrl, fileCat);
      setFileName("");
      setFileUrl("");
      setFileCat("Specification");
      setIsFileModalOpen(false);
      reloadProject(); // Refresh project to show files
    } catch (err: any) {
      setFileError(err.message || "Failed to confirm file link.");
    } finally {
      setIsFileSubmitting(false);
    }
  };

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
    setIsUploadingToCloudinary(true);
    setCloudinaryError(null);
    setFileName(file.name);

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
      setFileUrl(data.url);
      if (data.simulated) {
        setCloudinaryError("Workspace running in offline-local simulation mode. File mock URIs populated.");
      }
    } catch (err: any) {
      setCloudinaryError(err.message || "Failed uploading file");
    } finally {
      setIsUploadingToCloudinary(false);
    }
  };

  const handleToggleMemberSelect = (id: string) => {
    setTaskAssignees(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Check management privileges - everyone registered acts as admin-like inside their workspaces
  const canManage = true;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      
      {/* Return button */}
      <button 
        onClick={() => navigate("projects")}
        className="inline-flex items-center space-x-1 text-xs text-slate-500 font-bold hover:text-slate-800 transition-colors bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/50 shadow-2xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Portfolio Hub</span>
      </button>

      {/* Project Cover Block */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs relative">
        <div className="h-44 md:h-52 overflow-hidden bg-slate-900 relative">
          <img
            src={project.coverImageUrl || "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&q=80&w=600"}
            alt={project.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/60 to-transparent" />
          
          <div className="absolute bottom-5 left-6 right-6 flex flex-col md:flex-row md:items-end justify-between text-white space-y-4 md:space-y-0">
            <div>
              <div className="flex items-center space-x-2 text-[10px] uppercase font-mono tracking-wider text-slate-300 font-bold">
                <Calendar className="w-3.5 h-3.5" />
                <span>Range: {project.startDate} to {project.endDate}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight font-display mt-1 leading-tight">{project.name}</h2>
            </div>
            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleExportCSV}
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-mono text-[11px] font-bold py-2 inline-flex items-center space-x-1"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export Hours CSV</span>
              </Button>
              {canManage && (
                <button
                  onClick={handleDeleteProjectWorkspace}
                  className="p-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors shadow"
                  title="Wipe Project Environment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/50 text-xs font-mono font-medium text-slate-500">
          <div className="p-4 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <TrendingUp className="w-4 h-4 text-theme-teal" />
              <span>Workspace Progress:</span>
            </span>
            <span className="font-bold text-slate-800">{progressRatio}% completed</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-theme-purple" />
              <span>Time balance status:</span>
            </span>
            <span className="font-bold text-slate-800">{totalWorked}h / {totalEstimate}h worked</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Users className="w-4 h-4 text-teal-600" />
              <span>Staffing counts:</span>
            </span>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800">{project.members?.length || 0} Member(s)</span>
              <button
                onClick={() => setIsRosterModalOpen(true)}
                className="p-1.5 bg-teal-50 text-theme-teal hover:bg-teal-100 rounded-lg transition-colors flex items-center justify-center border border-theme-teal/20"
                title="Manage Project Members, Roles, Teams & Invitation Links"
              >
                <Settings className="w-3.5 h-3.5 animate-spin-slow" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Description and Document List Segment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Description brief & Activity Stream container */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-6">
            <div className="flex border-b border-slate-100 pb-2 space-x-4">
              <button
                onClick={() => setActiveDetailTab("charter")}
                className={`pb-2 text-xs font-bold uppercase tracking-wider font-display transition-all ${
                  activeDetailTab === "charter"
                    ? "text-[#3B62AB] border-b-2 border-[#3B62AB] font-extrabold"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Project Charter
              </button>
              <button
                onClick={() => setActiveDetailTab("activities")}
                className={`pb-2 text-xs font-bold uppercase tracking-wider font-display transition-all ${
                  activeDetailTab === "activities"
                    ? "text-[#3B62AB] border-b-2 border-[#3B62AB] font-extrabold"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Activity Stream
              </button>
            </div>

            {activeDetailTab === "charter" ? (
              <div 
                className="text-sm text-slate-600 leading-relaxed font-sans prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: project.richTextDescription }}
              />
            ) : (
              <ActivityStream projectId={projectId} />
            )}
          </div>
        </div>

        {/* Files panel */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display flex items-center space-x-1">
                <Paperclip className="w-4 h-4 text-slate-400" />
                <span>Documents Registry</span>
              </h3>
              <button
                onClick={() => setIsFileModalOpen(true)}
                className="text-[10px] text-theme-teal hover:underline font-bold font-mono"
              >
                + Register Link
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {project.files && project.files.length > 0 ? (
                project.files.map((file) => (
                  <div key={file.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs font-medium">
                    <div className="overflow-hidden pr-2">
                      <p className="font-bold text-slate-700 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono tracking-wide mt-0.5">{file.category}</p>
                    </div>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 rounded flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span className="text-[10px] font-bold">Get</span>
                    </a>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 italic text-[11px]">
                  No document logs registered.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-400 font-medium font-mono">
            Direct secure document connections
          </div>
        </div>
      </div>

      {/* Tasks Multi-View Tracker (Kanban / Gantt / Analytics) */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-xs gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-800 font-display uppercase">Workspace Board Workstation</h3>
              <p className="text-slate-400 text-xs mt-0.5">Synthesize tasks, schedule visual Gantt flow pathways, and inspect team velocity</p>
            </div>
            
            {/* High-quality Segmented Button Control Toolbar */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/40 select-none overflow-x-auto max-w-full">
              <button
                onClick={() => setViewMode("kanban")}
                className={`px-3 focus:outline-none py-1.5 text-[11px] font-bold uppercase rounded-lg font-mono tracking-wider transition-all cursor-pointer ${
                  viewMode === "kanban" 
                    ? "bg-white text-indigo-700 shadow-2xs font-extrabold" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Board Grid
              </button>
              <button
                onClick={() => setViewMode("gantt")}
                className={`px-3 focus:outline-none py-1.5 text-[11px] font-bold uppercase rounded-lg font-mono tracking-wider transition-all cursor-pointer ${
                  viewMode === "gantt" 
                    ? "bg-white text-indigo-700 shadow-2xs font-extrabold" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Gantt Timeline
              </button>
              <button
                onClick={() => setViewMode("analytics")}
                className={`px-3 focus:outline-none py-1.5 text-[11px] font-bold uppercase rounded-lg font-mono tracking-wider transition-all cursor-pointer ${
                  viewMode === "analytics" 
                    ? "bg-white text-indigo-700 shadow-2xs font-extrabold" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Sprint Analytics
              </button>
            </div>
          </div>

          <div className="shrink-0">
            <Button
              onClick={openNewTaskModal}
              variant="outline"
              size="sm"
              className="font-mono text-xs text-theme-teal border-theme-teal/30 hover:bg-teal-50"
            >
              + Create task sheet item
            </Button>
          </div>
        </div>

        {isTasksLoading ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs">
            <span className="animate-pulse">Loading sheets visual layouts...</span>
          </div>
        ) : (
          <div className="transition-all duration-200">
            {viewMode === "kanban" && (
              <KanbanBoard
                tasks={tasks}
                users={usersList}
                onTaskUpdated={() => {
                  reloadProject();
                  reloadTasks();
                }}
              />
            )}
            {viewMode === "gantt" && (
              <ProjectGanttChart
                tasks={tasks}
                users={usersList}
                project={project}
                onTaskUpdated={() => {
                  reloadProject();
                  reloadTasks();
                }}
              />
            )}
            {viewMode === "analytics" && (
              <ProjectSprintAnalytics
                tasks={tasks}
                users={usersList}
                project={project}
              />
            )}
          </div>
        )}
      </div>

      {/* Create Task Modal Dialog */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Add Task Sheet Item" size="lg">
        <form onSubmit={handleCreateTaskSubmit} className="space-y-4 font-sans">
          {taskError && (
            <div className="p-3 bg-pink-50 border border-pink-100 rounded-lg text-theme-pink text-xs font-semibold flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{taskError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="tsk-title"
              label="Task Title"
              placeholder="e.g. Audit API auth signatures"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="tsk-estimate"
                label="Estimated Hours"
                type="number"
                placeholder="e.g. 15"
                value={taskEstimate}
                onChange={(e) => setTaskEstimate(e.target.value)}
              />
              <Input
                id="tsk-due"
                label="Due Date"
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="tsk-status" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
                Initial Status
              </label>
              <select
                id="tsk-status"
                value={taskStatus}
                onChange={(e) => setTaskStatus(e.target.value as any)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-theme-teal focus:ring-1"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
              </select>
            </div>

            <div>
              <label htmlFor="tsk-priority" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
                Task Priority
              </label>
              <select
                id="tsk-priority"
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as any)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-theme-teal focus:ring-1"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label htmlFor="tsk-category" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
                Task Category Group
              </label>
              <select
                id="tsk-category"
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value as any)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-theme-teal focus:ring-1"
              >
                <option value="Development">Development</option>
                <option value="Design">Design</option>
                <option value="QA">QA</option>
                <option value="Management">Management</option>
                <option value="Billing">Billing</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          {/* Mentions in Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 px-1">
              Task Specifications Description (WYSIWYG @Mentions enabled)
            </label>
            <TipTapEditor
              value={taskDesc}
              onChange={setTaskDesc}
              placeholder="State clear task parameters. Type '@' to lookup mentionable workspace members!"
              projectId={projectId}
            />
          </div>

          {/* Allocation select panel */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 px-1">
              Directly Allocate Assignees
            </label>
            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50">
              {usersList.map((usr) => {
                const isSelected = taskAssignees.includes(usr.id);
                return (
                  <button
                    key={usr.id}
                    type="button"
                    onClick={() => handleToggleMemberSelect(usr.id)}
                    className={`flex items-center space-x-2.5 p-2 rounded-lg text-left transition-all text-xs font-medium border ${
                      isSelected
                        ? "bg-teal-50 border-theme-teal text-theme-teal font-bold shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      isSelected ? "border-theme-teal bg-theme-teal text-white" : "border-slate-300"
                    }`}>
                      {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <span className="truncate pr-1">{usr.name} (@{usr.username})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dependencies select panel */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>Task Dependencies (Pre-requisites)</span>
              <span className="text-[10px] font-mono text-slate-400 font-normal normal-case">Blocking completed status</span>
            </label>
            {tasks && tasks.filter(t => !t.deleted).length > 0 ? (
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50">
                {tasks.filter(t => !t.deleted).map((t) => {
                  const isSelected = taskDependencies.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setTaskDependencies(taskDependencies.filter(id => id !== t.id));
                        } else {
                          setTaskDependencies([...taskDependencies, t.id]);
                        }
                      }}
                      className={`flex items-center space-x-2.5 p-2 rounded-lg text-left transition-all text-xs font-medium border ${
                        isSelected
                          ? "bg-amber-50 border-theme-yellow text-slate-850 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-amber-400 bg-theme-yellow text-white flex items-center justify-center font-bold text-[8px]" : "border-slate-300"
                      }`}>
                        {isSelected && "✓"}
                      </div>
                      <div className="truncate min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[11px]">{t.title}</span>
                        <span className={`text-[9px] font-mono capitalize ${
                          t.status === "Done" ? "text-emerald-600 font-bold" : "text-amber-500 font-medium"
                        }`}>
                          Status: {t.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic px-2">No other task sheet items available in this project board to set as dependencies.</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isTaskSubmitting}>
              Apply task item
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload/Registry File Modal Dialog */}
      <Modal isOpen={isFileModalOpen} onClose={() => setIsFileModalOpen(false)} title="Register Project Document Link">
        <form onSubmit={handleFileUploadSubmit} className="space-y-4 font-sans">
          {fileError && (
            <div className="p-2.5 bg-pink-50 border border-pink-100 rounded-lg text-theme-pink text-xs font-semibold">
              {fileError}
            </div>
          )}

          {/* Cloudinary Visual Drag and Drop */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 px-1">
              Upload New Document
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-theme-teal rounded-xl p-5 text-center cursor-pointer bg-slate-50 hover:bg-slate-50/50 transition-all flex flex-col items-center justify-center space-y-2 group"
            >
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileChangeAndUpload}
              />
              <Paperclip className="w-8 h-8 text-slate-400 group-hover:text-theme-teal group-hover:scale-110 duration-200 transition-all" />
              {isUploadingToCloudinary ? (
                <span className="text-xs font-medium text-slate-500 animate-pulse">File uploading...</span>
              ) : (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 block">Drag & drop files or <span className="text-theme-teal underline group-hover:text-theme-teal/85">browse files</span></span>
                  <span className="text-[10px] text-slate-400 block">PDFs, Sheets, Images, DOCs up to 50MB</span>
                </div>
              )}
            </div>
            {cloudinaryError && (
              <p className="text-[10px] text-amber-600 font-semibold mt-1 px-1">{cloudinaryError}</p>
            )}
          </div>

          <Input
            id="f-name"
            label="Document Name / Title"
            placeholder="e.g. API Specification PDF"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            required
          />

          <Input
            id="f-url"
            label="Direct File access link / Base64"
            placeholder="https://example-bucket.s3.amazonaws.com/..."
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            required
          />

          <div>
            <label htmlFor="f-cat" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
              Doc Category Label
            </label>
            <select
              id="f-cat"
              value={fileCat}
              onChange={(e) => setFileCat(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-theme-teal focus:ring-1"
            >
              <option value="Specification">Specification</option>
              <option value="Cover Photo">Cover Photo</option>
              <option value="Mockup / Figma">Mockup / Figma</option>
              <option value="Billing / Invoice">Billing / Invoice</option>
              <option value="Client Contract">Client Contract</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsFileModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isFileSubmitting}>
              Log Document link
            </Button>
          </div>
        </form>
      </Modal>

      {/* Project Staffing & Alignment Modal */}
      <Modal isOpen={isRosterModalOpen} onClose={() => setIsRosterModalOpen(false)} title="Project Staffing & Alignment Panel" size="lg">
        <div className="space-y-6 font-sans">
          
          {/* Section 1: Invitation Register Link Draft */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1">
              <Link className="w-4 h-4 text-theme-teal" />
              <span>Draft Account invitation Link (Auto-Approved)</span>
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Generate a custom registration URL for team candidates. Users registering through this invitation link bypass traditional administrator approval flow.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-500 mb-1">Target Account Role</label>
                <select
                  value={selectedInviteRole}
                  onChange={(e) => setSelectedInviteRole(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="TEAM_LEAD">Team Leader</option>
                  <option value="DEVELOPER">Developer</option>
                  <option value="DESIGNER">Designer</option>
                  <option value="SENIOR">Senior Specialist</option>
                  <option value="JUNIOR">Junior Associate</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-500 mb-1">Target Squad / Team</label>
                <div className="space-y-2">
                  <select
                    value={selectedInviteTeamId}
                    onChange={(e) => setSelectedInviteTeamId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">-- No predefined team --</option>
                    {teamsList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  
                  {/* Inline Team Creator Option */}
                  <div className="pt-1">
                    {isCreatingNewTeamInline ? (
                      <form onSubmit={handleCreateTeamInline} className="p-3 bg-white border border-amber-200 rounded-lg space-y-2">
                        <p className="text-[9px] font-bold text-amber-800 uppercase tracking-wider font-mono">Create New Team</p>
                        <input
                          type="text"
                          placeholder="e.g. Design Team"
                          value={newTeamInlineName}
                          onChange={(e) => setNewTeamInlineName(e.target.value)}
                          className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Team description (optional)"
                          value={newTeamInlineDesc}
                          onChange={(e) => setNewTeamInlineDesc(e.target.value)}
                          className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded"
                        />
                        <div className="flex justify-end gap-1.5 text-[9px]">
                          <button type="button" onClick={() => setIsCreatingNewTeamInline(false)} className="px-2 py-0.5 border bg-slate-50 rounded">Cancel</button>
                          <button type="submit" className="px-2 py-0.5 bg-theme-teal text-slate-950 font-bold rounded">Create</button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setIsCreatingNewTeamInline(true)}
                        className="text-[10px] text-theme-teal hover:underline font-bold"
                      >
                        + Create a New Team Squad
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Link Box */}
            <div className="pt-2">
              <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl p-2 pl-3">
                <span className="text-[10px] font-mono text-slate-400 select-all truncate flex-1">
                  {`${window.location.origin}/#/register?invite=true&role=${selectedInviteRole}${selectedInviteTeamId ? `&teamId=${selectedInviteTeamId}` : ""}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/#/register?invite=true&role=${selectedInviteRole}${selectedInviteTeamId ? `&teamId=${selectedInviteTeamId}` : ""}`;
                    navigator.clipboard.writeText(url);
                    setIsInviteCopied(true);
                    setTimeout(() => setIsInviteCopied(false), 2000);
                  }}
                  className="p-1 px-3 bg-theme-black text-white hover:bg-slate-800 text-[10px] font-bold uppercase rounded-lg flex items-center space-x-1 transition-all"
                >
                  {isInviteCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-theme-green" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-white" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Section 2: Current Team Members list in Project */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display flex items-center space-x-1">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Current Project Workers ({project?.members?.length || 0})</span>
            </h3>
            
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {usersList.filter(u => project?.members?.includes(u.id)).map(usr => (
                <div key={usr.id} className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-extrabold text-slate-800">{usr.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wide ml-1.5">@{usr.username}</span>
                    <div className="flex gap-2 mt-1">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] uppercase font-bold tracking-wider">{usr.role}</span>
                      {usr.teamId && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-theme-purple rounded text-[9px] uppercase font-bold tracking-wider">
                          {teamsList.find(t => t.id === usr.teamId)?.name || "Assigned Team"}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Inline controls to configure Role & Team */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="space-y-1">
                      <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold font-mono">Set Role</span>
                      <select
                        value={editingUserRoles[usr.id] !== undefined ? editingUserRoles[usr.id] : usr.role}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingUserRoles(prev => ({ ...prev, [usr.id]: val }));
                        }}
                        className="p-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-[11px]"
                      >
                        <option value="PROJECT_MANAGER">Project Manager</option>
                        <option value="TEAM_LEAD">Team Leader</option>
                        <option value="DEVELOPER">Developer</option>
                        <option value="DESIGNER">Designer</option>
                        <option value="SENIOR">Senior Specialist</option>
                        <option value="JUNIOR">Junior Associate</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold font-mono">Set Team</span>
                      <select
                        value={editingUserTeams[usr.id] !== undefined ? editingUserTeams[usr.id] : (usr.teamId || "none")}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingUserTeams(prev => ({ ...prev, [usr.id]: val }));
                        }}
                        className="p-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-[11px]"
                      >
                        <option value="none">-- No Team --</option>
                        {teamsList.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-end h-full pt-4">
                      <button
                        type="button"
                        onClick={() => handleUpdateUserRosterDetails(usr.id, usr)}
                        disabled={isAligningUser === usr.id}
                        className="p-1 px-2 mb-1 bg-theme-teal hover:bg-teal-400 text-slate-950 font-bold font-mono text-[9px] uppercase rounded"
                      >
                        {isAligningUser === usr.id ? "Saving..." : "Apply"}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleRemoveUserFromProject(usr.id)}
                        className="p-1 mb-1 text-slate-400 hover:text-theme-pink hover:bg-pink-50 rounded ml-1"
                        title="Dismiss from project workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {usersList.filter(u => project?.members?.includes(u.id)).length === 0 && (
                <p className="text-xs text-slate-400 italic py-4 text-center">No staffing elements added to this project portfolio workspace.</p>
              )}
            </div>
          </div>
          
          {/* Section 3: Add Approved Staff Directory members */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display flex items-center space-x-1">
              <Plus className="w-4 h-4 text-slate-400" />
              <span>Invite Approved Corporate Staff Directory Users</span>
            </h3>
            
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {usersList.filter(u => !project?.members?.includes(u.id)).map(usr => (
                <div key={usr.id} className="p-2 bg-white border border-slate-100 rounded-lg flex items-center justify-between text-xs">
                  <div className="truncate pr-1">
                    <p className="font-extrabold text-slate-800 truncate">{usr.name}</p>
                    <p className="text-[9px] text-slate-400 font-mono">@{usr.username}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddUserToProject(usr.id)}
                    className="p-1 px-2.5 bg-slate-100 hover:bg-theme-teal hover:text-slate-950 text-slate-600 font-bold rounded text-[10px]"
                  >
                    + Add
                  </button>
                </div>
              ))}
              {usersList.filter(u => !project?.members?.includes(u.id)).length === 0 && (
                <p className="col-span-full text-xs text-slate-400 italic text-center py-4">All approved company workers are already assigned to this project.</p>
              )}
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button type="button" variant="primary" onClick={() => setIsRosterModalOpen(false)}>
              Close Panel
            </Button>
          </div>
          
        </div>
      </Modal>

    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { 
  Trash2, 
  RotateCcw, 
  Trash, 
  Calendar, 
  AlertCircle,
  FileText,
  CheckSquare,
  Sparkles,
  Info
} from "lucide-react";

interface TrashedProject {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  deletedAt?: string;
}

interface TrashedTask {
  id: string;
  title: string;
  projectName?: string;
  category: string;
  deletedAt?: string;
}

export default function TrashBinView() {
  const token = useUIStore((state) => state.token);
  const navigate = useUIStore((state) => state.navigate);
  const [projects, setProjects] = useState<TrashedProject[]>([]);
  const [tasks, setTasks] = useState<TrashedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "projects" | "tasks">("all");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchTrashItems = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/trash", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setTasks(data.tasks || []);
      } else {
        const err = await res.json();
        setFeedback({ type: "error", message: err.error || "Failed to load trashed items." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Network connection error loading trash." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashItems();
  }, [token]);

  const handleRestore = async (type: "project" | "task", id: string) => {
    if (!token) return;
    setActioningId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/trash/restore/${type}/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", message: result.message || "Item was restored successfully!" });
        fetchTrashItems();
      } else {
        setFeedback({ type: "error", message: result.error || "Failed to restore item." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Network error restoring item." });
    } finally {
      setActioningId(null);
    }
  };

  const handlePermanentDelete = async (type: "project" | "task", id: string, name: string) => {
    const confirmDelete = window.confirm(`Are you absolutely sure you want to permanently delete "${name}"? This will delete all associated storage and cannot be undone.`);
    if (!confirmDelete) return;

    if (!token) return;
    setActioningId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/trash/delete/${type}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", message: result.message || "Item permanently wiped!" });
        fetchTrashItems();
      } else {
        setFeedback({ type: "error", message: result.error || "Failed to delete item permanently." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Network error deleting item." });
    } finally {
      setActioningId(null);
    }
  };

  const calculateDaysRemaining = (deletedAtDateString?: string) => {
    if (!deletedAtDateString) return 15;
    const deletedDate = new Date(deletedAtDateString);
    const msDiff = Date.now() - deletedDate.getTime();
    const daysDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    const remaining = 15 - daysDiff;
    return remaining > 0 ? remaining : 0;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      
      {/* Visual Header Block */}
      <div className="bg-white border border-slate-200/80 p-6 md:p-8 rounded-2xl shadow-neo-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 font-sans font-bold text-7xl select-none uppercase tracking-widest text-[#3B62AB]">
          Trash
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 bg-[#FFF6F2] text-[#3B62AB] text-xs font-mono font-bold rounded-lg border border-[#3B62AB]/20 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Workspace Archives</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 font-sans mt-2">
              Trash Box
            </h1>
            <p className="text-slate-500 text-xs">
              Soft-deleted projects and tasks are safely held here for <strong className="text-slate-700">15 days</strong>. Afterward, they are auto-purged from the database and Cloudinary storage permanently.
            </p>
          </div>
          <div>
            <Button
              onClick={() => navigate("dashboard")}
              variant="outline"
              size="sm"
              className="border-slate-300 font-mono text-[11px] font-bold"
            >
              Back to Workspace
            </Button>
          </div>
        </div>
      </div>

      {/* Info warning */}
      <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-xl flex items-start space-x-3 text-xs text-amber-800">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <p className="font-bold">Permanent Deletion Alert</p>
          <p className="opacity-90">Deleting a Project permanently from the Trash Box immediately triggers Cascade deletion on all child tasks, child comment strings, and associated remote files archived on Cloudinary.</p>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-mono font-medium border flex items-center space-x-2 ${
          feedback.type === "success" 
            ? "bg-[#DAE9C6] border-[#3B62AB]/30 text-slate-900" 
            : "bg-red-50 border-red-200 text-red-900"
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Segmented Filter Tab Controls */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-xl border border-slate-300/40 max-w-md">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
            activeTab === "all" ? "bg-white text-slate-950 shadow-neo-sm font-extrabold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          All ({projects.length + tasks.length})
        </button>
        <button
          onClick={() => setActiveTab("projects")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
            activeTab === "projects" ? "bg-white text-slate-950 shadow-neo-sm font-extrabold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Projects ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
            activeTab === "tasks" ? "bg-white text-slate-950 shadow-neo-sm font-extrabold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Tasks ({tasks.length})
        </button>
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B62AB] mx-auto mb-2" />
          <span className="text-xs text-slate-400 font-medium">Scanning trash database...</span>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Projects List if matches tab */}
          {activeTab !== "tasks" && projects.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Trashed Projects ({projects.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj) => {
                  const daysLeft = calculateDaysRemaining(proj.deletedAt);
                  return (
                    <div 
                      key={proj.id} 
                      className="bg-white border-2 border-slate-200/80 p-5 rounded-xl hover:border-slate-800 transition-colors flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center space-x-1 text-[10px] uppercase font-mono tracking-wide text-slate-400">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Project</span>
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-md font-mono text-[9px] font-bold ${
                            daysLeft <= 3 ? "bg-red-100 text-red-800 border border-red-300" : "bg-[#FFF6F2] text-[#3B62AB] border border-[#3B62AB]/20"
                          }`}>
                            {daysLeft} days until purge
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#3B62AB] transition-colors">{proj.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">Deleted on: {proj.deletedAt ? new Date(proj.deletedAt).toLocaleString() : "Unknown"}</p>
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                        <Button
                          disabled={actioningId === proj.id}
                          onClick={() => handleRestore("project", proj.id)}
                          variant="outline"
                          size="sm"
                          className="font-mono text-[10px] font-bold border-slate-300 text-slate-705 inline-flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3 text-[#3B62AB]" />
                          <span>Restore</span>
                        </Button>
                        <Button
                          disabled={actioningId === proj.id}
                          onClick={() => handlePermanentDelete("project", proj.id, proj.name)}
                          variant="danger"
                          size="sm"
                          className="font-mono text-[10px] font-bold text-white inline-flex items-center space-x-1"
                        >
                          <Trash className="w-3 h-3 text-white" />
                          <span>Purge</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks List if matches tab */}
          {activeTab !== "projects" && tasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mt-4">Trashed Task Sheets ({tasks.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map((task) => {
                  const daysLeft = calculateDaysRemaining(task.deletedAt);
                  return (
                    <div 
                      key={task.id} 
                      className="bg-white border-2 border-slate-200/80 p-5 rounded-xl hover:border-slate-800 transition-colors flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center space-x-1 text-[10px] uppercase font-mono tracking-wide text-slate-400">
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Task Column</span>
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-md font-mono text-[9px] font-bold ${
                            daysLeft <= 3 ? "bg-red-100 text-red-800 border border-red-300" : "bg-[#FFF6F2] text-[#3B62AB] border border-[#3B62AB]/20"
                          }`}>
                            {daysLeft} days until purge
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                        {task.projectName && (
                          <p className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg inline-block my-1">
                            Board: {task.projectName}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 font-mono">Deleted on: {task.deletedAt ? new Date(task.deletedAt).toLocaleString() : "Unknown"}</p>
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                        <Button
                          disabled={actioningId === task.id}
                          onClick={() => handleRestore("task", task.id)}
                          variant="outline"
                          size="sm"
                          className="font-mono text-[10px] font-bold border-slate-300 text-slate-750 inline-flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3 text-[#3B62AB]" />
                          <span>Restore</span>
                        </Button>
                        <Button
                          disabled={actioningId === task.id}
                          onClick={() => handlePermanentDelete("task", task.id, task.title)}
                          variant="danger"
                          size="sm"
                          className="font-mono text-[10px] font-bold text-white inline-flex items-center space-x-1"
                        >
                          <Trash className="w-3 h-3 text-white" />
                          <span>Purge</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {((activeTab === "all" && projects.length === 0 && tasks.length === 0) ||
            (activeTab === "projects" && projects.length === 0) ||
            (activeTab === "tasks" && tasks.length === 0)) && (
            <div className="py-20 text-center bg-white border border-slate-200 rounded-2xl shadow-neo-sm">
              <Trash2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Trash Bin is Empty</p>
              <p className="text-xs text-slate-400 mt-1">There are no items currently slated for permanent automatic cleanup.</p>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

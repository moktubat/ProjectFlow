import React, { useState, useEffect } from "react";
import { useTasks } from "../../hooks/useTasks.js";
import { useProjects } from "../../hooks/useProjects.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Modal } from "../ui/Modal.js";
import { Input } from "../ui/Input.js";
import { CheckSquare, Calendar, Clock, Filter, Plus, AlertCircle } from "lucide-react";

const PRIORITY_BADGE: Record<string, string> = {
  Low: "bg-[#F4F4F4] text-[#737373]",
  Medium: "bg-[#fef3dc] text-[#9a5b00]",
  High: "bg-orange-50 text-orange-700",
  Critical: "bg-red-50 text-red-700",
};
const STATUS_BADGE: Record<string, string> = {
  "To Do": "bg-[#F4F4F4] text-[#737373]",
  "In Progress": "bg-[#e8edfb] text-[#0038BC]",
  Review: "bg-[#fef3dc] text-[#9a5b00]",
  Done: "bg-green-50 text-green-700",
};

export function TasksListView() {
  const { tasks, isLoading, error, refresh: refreshTasks, createTask } = useTasks();
  const { projects, isLoading: projLoading } = useProjects();
  const navigate = useUIStore((s) => s.navigate);

  const [filterPriority, setFilterPriority] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskCategory, setTaskCategory] = useState<any>("Development");
  const [taskPriority, setTaskPriority] = useState<any>("Medium");
  const [taskStatus, setTaskStatus] = useState<any>("To Do");
  const [taskDueDate, setTaskDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [taskEstHours, setTaskEstHours] = useState("1");
  const [taskDescription, setTaskDescription] = useState("");
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  useEffect(() => {
    if (projects.length && !taskProjectId) setTaskProjectId(projects[0].id);
  }, [projects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskProjectId) { setCreateTaskError("Select a project."); return; }
    if (!taskTitle.trim()) { setCreateTaskError("Task title is required."); return; }
    setIsCreatingTask(true);
    setCreateTaskError(null);
    try {
      await createTask({ projectId: taskProjectId, title: taskTitle.trim(), richTextDesc: taskDescription.trim(), status: taskStatus, priority: taskPriority, category: taskCategory, dueDate: taskDueDate, estimatedHours: Number(taskEstHours) || 0, assignees: [], timeLogs: [] });
      setTaskTitle(""); setTaskDescription(""); setTaskEstHours("1");
      setIsTaskModalOpen(false);
      refreshTasks();
    } catch (err: any) {
      setCreateTaskError(err.message);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const filtered = tasks.filter((t) => {
    if (filterPriority !== "All" && t.priority !== filterPriority) return false;
    if (filterCategory !== "All" && t.category !== filterCategory) return false;
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    return true;
  });

  const selectCls = "px-2.5 py-1.5 border border-[#D0D0D0] rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-xl border border-[#E8E8E8] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Tasks</h2>
          <p className="text-sm text-[#737373] mt-0.5">All tasks across your projects</p>
        </div>
        <Button onClick={() => setIsTaskModalOpen(true)} variant="primary">
          <Plus className="w-4 h-4" />
          New task
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] px-5 py-3.5 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-sm text-[#737373] font-medium">
          <Filter className="w-4 h-4" /> Filter
        </span>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="f-status" className="text-xs text-[#737373]">Status</label>
            <select id="f-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
              {["All", "To Do", "In Progress", "Review", "Done"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="f-priority" className="text-xs text-[#737373]">Priority</label>
            <select id="f-priority" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={selectCls}>
              {["All", "Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="f-category" className="text-xs text-[#737373]">Category</label>
            <select id="f-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={selectCls}>
              {["All", "Development", "Design", "QA", "Management", "Billing", "Others"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <span className="ml-auto text-sm text-[#737373]">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-xl divide-y divide-[#F4F4F4] overflow-hidden">
          {filtered.map((t) => {
            const worked = t.timeLogs?.reduce((s, l) => s + l.hours, 0) || 0;
            return (
              <button
                key={t.id}
                onClick={() => navigate(`tasks/${t.id}`)}
                className="w-full text-left px-5 py-4 hover:bg-[#F7F8FA] transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-[#737373] bg-[#F4F4F4] px-2 py-0.5 rounded">{t.category}</span>
                    {t.projectName && <span className="text-xs text-[#A0A0A0] truncate">· {t.projectName}</span>}
                  </div>
                  <p className="text-sm font-medium text-[#111111] truncate">{t.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#A0A0A0]">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Due {t.dueDate}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{worked}h / {t.estimatedHours}h</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-md ${PRIORITY_BADGE[t.priority] || "bg-[#F4F4F4] text-[#737373]"}`}>{t.priority}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md ${STATUS_BADGE[t.status] || "bg-[#F4F4F4] text-[#737373]"}`}>{t.status}</span>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CheckSquare className="w-10 h-10 text-[#D0D0D0] mb-3" />
              <p className="font-medium text-[#525252]">No tasks found</p>
              <p className="text-sm text-[#A0A0A0] mt-1">Try adjusting your filters or create a new task.</p>
            </div>
          )}
        </div>
      )}

      {/* Create task modal */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="New task" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          {createTaskError && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {createTaskError}
            </div>
          )}

          <div>
            <label htmlFor="ct-project" className="block text-sm font-medium text-[#3D3D3D] mb-1">Project *</label>
            <select id="ct-project" value={taskProjectId} onChange={(e) => setTaskProjectId(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]">
              <option value="" disabled>Select a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!projLoading && projects.length === 0 && <p className="text-xs text-red-600 mt-1">No projects found — create one first.</p>}
          </div>

          <Input label="Task title *" id="ct-title" placeholder="e.g. Set up API proxy" value={taskTitle} onChange={(e: any) => setTaskTitle(e.target.value)} required />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ct-cat" className="block text-sm font-medium text-[#3D3D3D] mb-1">Category</label>
              <select id="ct-cat" value={taskCategory} onChange={(e) => setTaskCategory(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]">
                {["Development", "Design", "QA", "Management", "Billing", "Others"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ct-pri" className="block text-sm font-medium text-[#3D3D3D] mb-1">Priority</label>
              <select id="ct-pri" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]">
                {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="ct-status" className="block text-sm font-medium text-[#3D3D3D] mb-1">Status</label>
              <select id="ct-status" value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]">
                {["To Do", "In Progress", "Review", "Done"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <Input label="Due date *" id="ct-due" type="date" value={taskDueDate} onChange={(e: any) => setTaskDueDate(e.target.value)} required />
            <Input label="Est. hours" id="ct-hrs" type="number" min="0.5" step="0.5" value={taskEstHours} onChange={(e: any) => setTaskEstHours(e.target.value)} />
          </div>

          <div>
            <label htmlFor="ct-desc" className="block text-sm font-medium text-[#3D3D3D] mb-1">Description</label>
            <textarea id="ct-desc" rows={3} placeholder="Task notes, checklist, specs…" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm placeholder:text-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC] resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E8E8E8]">
            <Button type="button" variant="outline" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isCreatingTask} disabled={projects.length === 0}>Create task</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
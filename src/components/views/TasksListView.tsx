import React, { useState, useEffect } from "react";
import { useTasks } from "../../hooks/useTasks.js";
import { useProjects } from "../../hooks/useProjects.js";
import { useUIStore } from "../../store/ui-store.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { Button } from "../ui/Button.js";
import { SlidePanel } from "../ui/SlidePanel.js";
import { Input } from "../ui/Input.js";
import { MarkdownEditor } from "../editor/MarkdownEditor.js";
import { CheckSquare, Calendar, Clock, Filter, Plus, AlertCircle } from "lucide-react";
import { CATEGORY_STYLES, PRIORITY_STYLES } from "@/src/lib/badge-styles.js";

export function TasksListView() {
  usePageTitle("My Tasks", "View and manage all your tasks across every project in ProjectFlow.");

  const { tasks, isLoading, error, refresh: refreshTasks, createTask } = useTasks();
  const { projects, isLoading: projLoading } = useProjects();
  const navigate = useUIStore((s) => s.navigate);

  const [filterPriority, setFilterPriority] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [isPanelOpen, setIsPanelOpen] = useState(false);

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

  const resetForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskEstHours("1");
    setCreateTaskError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskProjectId) { setCreateTaskError("Select a project."); return; }
    if (!taskTitle.trim()) { setCreateTaskError("Task title is required."); return; }
    setIsCreatingTask(true);
    setCreateTaskError(null);
    try {
      await createTask({
        projectId: taskProjectId,
        title: taskTitle.trim(),
        richTextDesc: taskDescription.trim(),
        status: taskStatus,
        priority: taskPriority,
        category: taskCategory,
        dueDate: taskDueDate,
        estimatedHours: Number(taskEstHours) || 0,
        assignees: [],
        timeLogs: [],
      });
      resetForm();
      setIsPanelOpen(false);
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

  // Derive selected project name for a helpful panel subtitle
  const selectedProject = projects.find((p) => p.id === taskProjectId);

  const selectCls =
    "px-2.5 py-1.5 border border-[#D0D0D0] rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]";
  const SEL =
    "w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/20 focus:border-[#0038BC]";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-xl border border-[#E8E8E8] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Tasks</h2>
          <p className="text-sm text-[#737373] mt-0.5">All tasks across your projects</p>
        </div>
        <Button onClick={() => setIsPanelOpen(true)} variant="primary">
          <Plus className="w-4 h-4" /> New task
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] px-5 py-3.5 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-sm text-[#737373] font-medium">
          <Filter className="w-4 h-4" /> Filter
        </span>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Status", id: "f-status", val: filterStatus, set: setFilterStatus, opts: ["All", "To Do", "In Progress", "Review", "Done"] },
            { label: "Priority", id: "f-priority", val: filterPriority, set: setFilterPriority, opts: ["All", "Low", "Medium", "High", "Critical"] },
            { label: "Category", id: "f-category", val: filterCategory, set: setFilterCategory, opts: ["All", "Development", "Design", "QA", "Management", "Billing", "Others"] },
          ].map(({ label, id, val, set, opts }) => (
            <div key={id} className="flex items-center gap-2">
              <label htmlFor={id} className="text-xs text-[#737373]">{label}</label>
              <select id={id} value={val} onChange={(e) => set(e.target.value)} className={selectCls}>
                {opts.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        <span className="ml-auto text-sm text-[#737373]">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
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
                    <span className="text-xs text-[#737373] bg-[#F4F4F4] px-2 py-0.5 rounded">
                      {t.category}
                    </span>
                    {t.projectName && (
                      <span className="text-xs text-[#A0A0A0] truncate">· {t.projectName}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#111111] truncate">{t.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#A0A0A0]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />Due {t.dueDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />{worked}h / {t.estimatedHours}h
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-md ${PRIORITY_STYLES[t.priority] || "bg-[#F4F4F4] text-[#737373]"}`}>
                    {t.priority}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-md ${CATEGORY_STYLES[t.category] || "bg-[#F4F4F4] text-[#737373]"}`}>
                    {t.category}
                  </span>
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

      {/* New task slide panel */}
      <SlidePanel
        isOpen={isPanelOpen}
        onClose={() => { setIsPanelOpen(false); resetForm(); }}
        title="New task"
        description={
          selectedProject
            ? `Creating task in "${selectedProject.name}"`
            : "Fill in the details below to create a task."
        }
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {createTaskError && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {createTaskError}
            </div>
          )}

          {/* Project selector — first so the subtitle updates */}
          <div>
            <label className="block text-sm font-medium text-[#3D3D3D] mb-1">Project *</label>
            <select
              value={taskProjectId}
              onChange={(e) => setTaskProjectId(e.target.value)}
              className={SEL}
            >
              <option value="" disabled>Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {!projLoading && projects.length === 0 && (
              <p className="text-xs text-red-600 mt-1">No projects found — create one first.</p>
            )}
          </div>

          <Input
            label="Task title *"
            placeholder="e.g. Set up API proxy"
            value={taskTitle}
            onChange={(e: any) => setTaskTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#3D3D3D] mb-1">Category</label>
              <select value={taskCategory} onChange={(e) => setTaskCategory(e.target.value)} className={SEL}>
                {["Development", "Design", "QA", "Management", "Billing", "Others"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3D3D3D] mb-1">Priority</label>
              <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className={SEL}>
                {["Low", "Medium", "High", "Critical"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#3D3D3D] mb-1">Status</label>
              <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} className={SEL}>
                {["To Do", "In Progress", "Review", "Done"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <Input
              label="Due date *"
              type="date"
              value={taskDueDate}
              onChange={(e: any) => setTaskDueDate(e.target.value)}
              required
            />
            <Input
              label="Est. hours"
              type="number"
              min="0.5"
              step="0.5"
              value={taskEstHours}
              onChange={(e: any) => setTaskEstHours(e.target.value)}
            />
          </div>

          {/* Rich text description — same editor as Project Details */}
          <div>
            <label className="block text-sm font-medium text-[#3D3D3D] mb-1">Description</label>
            <MarkdownEditor
              value={taskDescription}
              onChange={setTaskDescription}
              placeholder="Describe what needs to be done, acceptance criteria, links…"
              projectId={taskProjectId || undefined}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E8E8E8]">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setIsPanelOpen(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isCreatingTask}
              disabled={projects.length === 0}
            >
              Create task
            </Button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useTasks } from "../../hooks/useTasks.js";
import { useProjects } from "../../hooks/useProjects.js";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Modal } from "../ui/Modal.js";
import { Input } from "../ui/Input.js";
import { CheckSquare, Calendar, Flame, Clock, Award, Filter, AlertCircle, Plus } from "lucide-react";

export function TasksListView() {
  const { tasks, isLoading, error, refresh: refreshTasks, createTask } = useTasks();
  const { projects, isLoading: isProjectsLoading } = useProjects();
  const navigate = useUIStore((state) => state.navigate);

  // Filters state
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");

  // Create task modal open state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Create task form states
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskCategory, setTaskCategory] = useState<"Development" | "Design" | "QA" | "Management" | "Billing" | "Others">("Development");
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [taskStatus, setTaskStatus] = useState<"To Do" | "In Progress" | "Review" | "Done">("To Do");
  const [taskDueDate, setTaskDueDate] = useState(() => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  });
  const [taskEstHours, setTaskEstHours] = useState("1");
  const [taskDescription, setTaskDescription] = useState("");
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Pre-select first project as soon as projects load
  useEffect(() => {
    if (projects && projects.length > 0 && !taskProjectId) {
      setTaskProjectId(projects[0].id);
    }
  }, [projects, taskProjectId]);

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskProjectId) {
      setCreateTaskError("Please pick a project for this task.");
      return;
    }
    if (!taskTitle.trim()) {
      setCreateTaskError("Task title is required.");
      return;
    }
    if (!taskDueDate) {
      setCreateTaskError("Due date is required.");
      return;
    }

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
        timeLogs: []
      });

      // Reset form states
      setTaskTitle("");
      setTaskDescription("");
      if (projects && projects.length > 0) {
        setTaskProjectId(projects[0].id);
      } else {
        setTaskProjectId("");
      }
      setTaskCategory("Development");
      setTaskPriority("Medium");
      setTaskStatus("To Do");
      const d = new Date();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      setTaskDueDate(`${d.getFullYear()}-${month}-${day}`);
      setTaskEstHours("1");
      setCreateTaskError(null);
      setIsTaskModalOpen(false);
      refreshTasks();
    } catch (err: any) {
      setCreateTaskError(err.message || "Failed to create task.");
    } finally {
      setIsCreatingTask(false);
    }
  };

  const getPriorityBadgeColors = (p: string) => {
    switch (p) {
      case "Low": return "bg-slate-100 text-slate-700";
      case "Medium": return "bg-amber-50 text-amber-700 border-amber-200/50";
      case "High": return "bg-orange-50 text-orange-700 border-orange-200/50";
      case "Critical": return "bg-pink-50 text-theme-pink border border-pink-200/50";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusBadgeColors = (s: string) => {
    switch (s) {
      case "To Do": return "bg-slate-100 text-slate-700";
      case "In Progress": return "bg-sky-50 text-sky-700 border border-sky-100";
      case "Review": return "bg-amber-50 text-theme-yellow border border-amber-100";
      case "Done": return "bg-emerald-50 text-emerald-700 border border-emerald-100";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterPriority !== "All" && t.priority !== filterPriority) return false;
    if (filterCategory !== "All" && t.category !== filterCategory) return false;
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
      
      {/* Header Container */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">System Tasks Registry</h2>
          <p className="text-slate-500 text-xs mt-1">Review operational, design, and engineering checklist sheets</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button
            onClick={() => setIsTaskModalOpen(true)}
            variant="primary"
            size="sm"
            className="font-bold text-xs inline-flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/85 shadow-2xs flex flex-wrap gap-4 items-center justify-between text-xs font-semibold">
        <div className="flex items-center space-x-2 text-slate-500 pr-2 border-r border-slate-200/60 font-display">
          <Filter className="w-4 h-4 text-theme-teal" />
          <span>PORTFOLIO FILTERS:</span>
        </div>

        <div className="flex flex-wrap gap-3.5 flex-1">
          {/* Status selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="filter-task-status" className="text-slate-400 font-bold uppercase font-mono text-[10px]">Lanes:</label>
            <select
              id="filter-task-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
            </select>
          </div>

          {/* Priority selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="filter-task-priority" className="text-slate-400 font-bold uppercase font-mono text-[10px]">Priority:</label>
            <select
              id="filter-task-priority"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none"
            >
              <option value="All">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {/* Category selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="filter-task-category" className="text-slate-400 font-bold uppercase font-mono text-[10px]">Category:</label>
            <select
              id="filter-task-category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="p-1 px-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="Development">Development</option>
              <option value="Design">Design</option>
              <option value="QA">QA</option>
              <option value="Management">Management</option>
              <option value="Billing">Billing</option>
              <option value="Others">Others</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400 font-bold">
          Found: {filteredTasks.length} task(s)
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-purple mx-auto"></div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Syncing system task checklists...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-pink-50 border border-pink-100 rounded-xl text-theme-pink text-xs font-semibold">
          Error loading task lists: {error}
        </div>
      ) : (
        /* Tasks list */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
          {filteredTasks.map((t) => {
            const totalWorked = t.timeLogs ? t.timeLogs.reduce((sum, log) => sum + log.hours, 0) : 0;
            return (
              <div
                key={t.id}
                onClick={() => navigate(`tasks/${t.id}`)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1.5 flex-1 pr-4 pr-1.2 overflow-hidden">
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-250/20 px-2 py-0.5 rounded text-slate-500 font-mono">
                      {t.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wide font-medium">
                      Project: {t.projectName || "Default Workspace"}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 leading-snug truncate">
                    {t.title}
                  </h3>
                  <div className="flex items-center space-x-4 text-[10px] text-slate-400 font-mono font-medium">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-350" />
                      <span>Due: {t.dueDate}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-350" />
                      <span>Estimate: {t.estimatedHours}h / Worked: {totalWorked}h</span>
                    </span>
                  </div>
                </div>

                {/* Badges container */}
                <div className="flex items-center space-x-3.5">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${getPriorityBadgeColors(t.priority)}`}>
                    Priority: {t.priority}
                  </span>
                  <span className={`px-2.5 py-1 rounded border text-[10px] font-bold ${getStatusBadgeColors(t.status)}`}>
                    {t.status}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="py-24 text-center text-slate-400">
              <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">No matching task sheets</p>
              <p className="text-xs text-slate-400 italic">Adjust filter variables or create sheets inside projects.</p>
            </div>
          )}
        </div>
      )}

      {/* Interactive Modal to Create Task with dropdown selection */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Initialize New Task Sheet"
        size="md"
      >
        <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
          {createTaskError && (
            <div className="p-3 bg-pink-50 border border-pink-100 rounded-xl text-[11px] text-theme-pink leading-normal font-bold">
              ⚠️ Error: {createTaskError}
            </div>
          )}

          {/* Project Selection Dropdown */}
          <div className="space-y-1">
            <label htmlFor="task-project" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
              Select Workspace Project *
            </label>
            <select
              id="task-project"
              value={taskProjectId}
              onChange={(e) => setTaskProjectId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-all font-semibold"
            >
              <option value="" disabled>-- Select project allocation --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {projects.length === 0 && !isProjectsLoading && (
              <p className="text-[11px] text-red-500 font-bold mt-1 px-1">
                ⚠️ No project spaces found. Create a project before logging tasks!
              </p>
            )}
          </div>

          {/* Task Title */}
          <Input
            label="Task Title *"
            id="task-title"
            placeholder="e.g. Set up API proxy endpoint"
            value={taskTitle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskTitle(e.target.value)}
            required
          />

          {/* Grid for Category and Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="task-category" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
                Category
              </label>
              <select
                id="task-category"
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-all font-semibold"
              >
                <option value="Development">Development</option>
                <option value="Design">Design</option>
                <option value="QA">QA</option>
                <option value="Management">Management</option>
                <option value="Billing">Billing</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="task-priority" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
                Priority Status
              </label>
              <select
                id="task-priority"
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-all font-semibold"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Grid for Status, Due Date, and Estimated Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label htmlFor="task-status" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
                Board Lane status
              </label>
              <select
                id="task-status"
                value={taskStatus}
                onChange={(e) => setTaskStatus(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-all font-semibold"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
              </select>
            </div>

            <Input
              label="Task Deadline *"
              id="task-dueDate"
              type="date"
              value={taskDueDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskDueDate(e.target.value)}
              required
            />

            <Input
              label="Estimated Hours"
              id="task-estimatedHours"
              type="number"
              min="0.5"
              step="0.5"
              value={taskEstHours}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskEstHours(e.target.value)}
              required
            />
          </div>

          {/* Description Textarea */}
          <div className="space-y-1">
            <label htmlFor="task-desc" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
              Task Notes / Description
            </label>
            <textarea
              id="task-desc"
              rows={3}
              placeholder="Provide functional goal, checklist specs, details, etc."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-all duration-250"
            />
          </div>

          {/* Dialog Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-150">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTaskModalOpen(false)}
              className="text-xs uppercase font-mono font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isCreatingTask || projects.length === 0}
              className="text-xs uppercase font-mono font-bold"
            >
              {isCreatingTask ? "Saving task..." : "Initialize Task Sheet"}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

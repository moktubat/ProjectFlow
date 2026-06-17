/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
    DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay,
    PointerSensor, TouchSensor, useSensor, useSensors, closestCorners, useDroppable,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, User } from "../../types/index.js";
import { useUIStore } from "../../store/ui-store.js";
import { Calendar, Clock, GitMerge, GripVertical } from "lucide-react";

interface TaskListBoardProps {
    tasks: Task[];
    users: User[];
    onTaskUpdated: () => void;
}

const STATUSES: Task["status"][] = ["To Do", "In Progress", "Review", "Done"];

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
    "To Do": { dot: "bg-[#A0A0A0]", text: "text-[#525252]", bg: "bg-[#F4F4F4]/60" },
    "In Progress": { dot: "bg-[#0038BC]", text: "text-[#0038BC]", bg: "bg-[#e8edfb]/40" },
    "Review": { dot: "bg-[#EF8F00]", text: "text-[#9a5b00]", bg: "bg-[#fef3dc]/40" },
    "Done": { dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50/40" },
};

const PRIORITY_STYLES: Record<string, string> = {
    Low: "bg-[#F4F4F4] text-[#737373]",
    Medium: "bg-[#fef3dc] text-[#9a5b00]",
    High: "bg-orange-50 text-orange-700",
    Critical: "bg-red-50 text-red-700",
};

function TaskListRow({ task, users, isOverlay = false }: { task: Task; users: User[]; isOverlay?: boolean }) {
    const navigate = useUIStore((s) => s.navigate);
    const logged = task.timeLogs.reduce((s, l) => s + l.hours, 0);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: task.id, disabled: isOverlay });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 999 : undefined,
    };

    const getUserInitial = (id: string) => users.find((u) => u.id === id)?.name.charAt(0).toUpperCase() ?? "?";
    const getUserName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
        flex items-center gap-3 bg-white border border-[#E8E8E8] rounded-lg px-3 py-2.5
        hover:border-[#0038BC]/30 hover:shadow-sm transition-all duration-100 group
        ${isDragging ? "shadow-lg ring-2 ring-[#0038BC]/20" : ""}
        ${isOverlay ? "shadow-2xl ring-2 ring-[#0038BC]/30" : ""}
      `}
        >
            <button
                {...attributes}
                {...listeners}
                className="shrink-0 p-1 text-[#D0D0D0] hover:text-[#A0A0A0] cursor-grab active:cursor-grabbing"
                aria-label="Drag to move task"
            >
                <GripVertical className="w-4 h-4" />
            </button>

            <button
                onClick={() => !isDragging && !isOverlay && navigate(`tasks/${task.id}`)}
                className="flex-1 min-w-0 text-left"
            >
                <p className="text-sm font-medium text-[#111111] truncate group-hover:text-[#0038BC] transition-colors">
                    {task.title}
                </p>
                <div className="flex items-center gap-3 text-xs text-[#737373] mt-0.5">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{task.dueDate}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{logged}h / {task.estimatedHours}h</span>
                    {task.dependencies && task.dependencies.length > 0 && (
                        <span className="flex items-center gap-1 text-[#EF8F00]"><GitMerge className="w-3 h-3" />{task.dependencies.length}</span>
                    )}
                </div>
            </button>

            <span className="hidden sm:inline-flex text-xs px-2 py-0.5 rounded-md font-medium shrink-0 bg-[#F4F4F4] text-[#737373]">
                {task.category}
            </span>

            <span className={`text-xs px-2 py-0.5 rounded-md font-medium shrink-0 ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.Low}`}>
                {task.priority}
            </span>

            <div className="flex -space-x-1.5 shrink-0">
                {task.assignees.length > 0 ? (
                    task.assignees.slice(0, 3).map((a, i) =>
                        a.userId ? (
                            <div key={i} title={getUserName(a.userId)} className="w-6 h-6 rounded-full bg-[#e8edfb] border-2 border-white text-[#0038BC] text-xs font-medium flex items-center justify-center">
                                {getUserInitial(a.userId)}
                            </div>
                        ) : (
                            <div key={i} title="Team" className="w-6 h-6 rounded-full bg-[#fef3dc] border-2 border-white text-[#EF8F00] text-xs font-medium flex items-center justify-center">T</div>
                        )
                    )
                ) : (
                    <span className="text-xs text-[#A0A0A0]">Unassigned</span>
                )}
            </div>
        </div>
    );
}

function TaskListSection({
    status, tasks, users, isAnyDragging,
}: { status: Task["status"]; tasks: Task[]; users: User[]; isAnyDragging: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const style = STATUS_STYLES[status];

    return (
        <div
            ref={setNodeRef}
            className={`
        rounded-xl border-2 p-3 transition-colors duration-150
        ${isOver ? `border-[#0038BC] ${style.bg}` : isAnyDragging ? "border-dashed border-[#D0D0D0] bg-[#F7F8FA]" : "border-[#E8E8E8] bg-[#F7F8FA]"}
      `}
        >
            <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className={`text-sm font-semibold ${style.text}`}>{status}</span>
                </div>
                <span className="text-xs text-[#737373] bg-[#EEEEEE] px-2 py-0.5 rounded-full font-medium">{tasks.length}</span>
            </div>

            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                    {tasks.map((t) => <TaskListRow key={t.id} task={t} users={users} />)}

                    {tasks.length === 0 && (
                        <div className={`h-16 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors duration-150 ${isOver ? "border-[#0038BC] bg-[#e8edfb]/20" : "border-[#D0D0D0]"}`}>
                            <span className="text-xs text-[#A0A0A0]">{isOver ? "Release to drop here" : "Drop here"}</span>
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

export function TaskListBoard({ tasks, users, onTaskUpdated }: TaskListBoardProps) {
    const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const token = useUIStore((s) => s.token);
    const isDragging = useRef(false);

    useEffect(() => {
        if (!isDragging.current) setLocalTasks(tasks);
    }, [tasks]);

    const handleNativeDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
    const handleNativeDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        isDragging.current = true;
        setErrorMsg(null);
        const task = localTasks.find((t) => t.id === event.active.id);
        setActiveTask(task ?? null);
    }, [localTasks]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;
        const activeId = active.id as string;
        const overId = over.id as string;
        const overTask = localTasks.find((t) => t.id === overId);
        const overStatus = overTask ? overTask.status : STATUSES.includes(overId as any) ? (overId as Task["status"]) : null;
        if (!overStatus) return;
        setLocalTasks((prev) => prev.map((t) => (t.id === activeId ? { ...t, status: overStatus } : t)));
    }, [localTasks]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        isDragging.current = false;
        setActiveTask(null);
        const { active, over } = event;
        if (!over || !token) return;
        const activeId = active.id as string;
        const movedTask = localTasks.find((t) => t.id === activeId);
        if (!movedTask) return;
        const newStatus = movedTask.status;
        const originalTask = tasks.find((t) => t.id === activeId);
        if (!originalTask || originalTask.status === newStatus) return;

        try {
            const res = await fetch(`/api/tasks/${activeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                const data = await res.json();
                setLocalTasks(tasks);
                setErrorMsg(data.error || "Could not move task — change rolled back.");
                setTimeout(() => setErrorMsg(null), 4000);
            } else {
                onTaskUpdated();
            }
        } catch {
            setLocalTasks(tasks);
            setErrorMsg("Network error — task move rolled back.");
            setTimeout(() => setErrorMsg(null), 4000);
        }
    }, [localTasks, tasks, token, onTaskUpdated]);

    const handleDragCancel = useCallback(() => {
        isDragging.current = false;
        setActiveTask(null);
        setLocalTasks(tasks);
    }, [tasks]);

    return (
        <div className="space-y-3" onDragOver={handleNativeDragOver} onDrop={handleNativeDrop}>
            {errorMsg && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errorMsg}
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="space-y-3">
                    {STATUSES.map((s) => (
                        <TaskListSection
                            key={s}
                            status={s}
                            tasks={localTasks.filter((t) => t.status === s && !t.deleted)}
                            users={users}
                            isAnyDragging={!!activeTask}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
                    {activeTask ? (
                        <div className="rotate-1 opacity-95 shadow-2xl">
                            <TaskListRow task={activeTask} users={users} isOverlay />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
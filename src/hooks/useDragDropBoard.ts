import { useState, useCallback, useRef, useEffect } from "react";
import {
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { Task } from "../types/index.js";

export const BOARD_STATUSES: Task["status"][] = [
    "To Do",
    "In Progress",
    "Review",
    "Done",
];

export function useDragDropBoard(
    tasks: Task[],
    onTaskUpdated: () => void
) {
    const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const isDragging = useRef(false);
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isDragging.current) setLocalTasks(tasks);
    }, [tasks]);

    const handleNativeDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleNativeDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

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
        const overTask = localTasks.find((t) => t.id === over.id);
        const overStatus = overTask
            ? overTask.status
            : BOARD_STATUSES.includes(over.id as Task["status"])
                ? (over.id as Task["status"])
                : null;
        if (!overStatus) return;
        setLocalTasks((prev) =>
            prev.map((t) => (t.id === active.id ? { ...t, status: overStatus } : t))
        );
    }, [localTasks]);

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            isDragging.current = false;
            setActiveTask(null);
            const { active, over } = event;
            if (!over) return;

            const movedTask = localTasks.find((t) => t.id === active.id);
            if (!movedTask) return;

            const newStatus = movedTask.status;
            const originalTask = tasks.find((t) => t.id === active.id);
            if (!originalTask || originalTask.status === newStatus) return;

            try {
                const res = await fetch(`/api/tasks/${active.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ status: newStatus }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({} as { error?: string }));
                    setLocalTasks(tasks);
                    setErrorMsg(data.error || "Could not move task — change rolled back.");
                    setTimeout(() => setErrorMsg(null), 4000);
                } else {
                    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
                    refreshTimerRef.current = setTimeout(() => onTaskUpdated(), 500);
                }
            } catch {
                setLocalTasks(tasks);
                setErrorMsg("Network error — task move rolled back.");
                setTimeout(() => setErrorMsg(null), 4000);
            }
        },
        [localTasks, tasks, onTaskUpdated]
    );

    const handleDragCancel = useCallback(() => {
        isDragging.current = false;
        setActiveTask(null);
        setLocalTasks(tasks);
    }, [tasks]);

    return {
        localTasks,
        activeTask,
        errorMsg,
        sensors,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel,
        handleNativeDragOver,
        handleNativeDrop,
    };
}
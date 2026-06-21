/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
    token: string | null,
    onTaskUpdated: () => void
) {
    const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const isDragging = useRef(false);

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
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 5 },
        })
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
        const overStatus = overTask
            ? overTask.status
            : BOARD_STATUSES.includes(overId as Task["status"])
                ? (overId as Task["status"])
                : null;
        if (!overStatus) return;

        setLocalTasks((prev) =>
            prev.map((t) => (t.id === activeId ? { ...t, status: overStatus } : t))
        );
    }, [localTasks]);

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            isDragging.current = false;
            setActiveTask(null);

            const { active, over } = event;
            if (!over || !token) return;

            const activeId = active.id as string;
            // Status was already applied optimistically in handleDragOver.
            const movedTask = localTasks.find((t) => t.id === activeId);
            if (!movedTask) return;

            const newStatus = movedTask.status;
            const originalTask = tasks.find((t) => t.id === activeId);
            if (!originalTask || originalTask.status === newStatus) return;

            try {
                const res = await fetch(`/api/tasks/${activeId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ status: newStatus }),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({} as { error?: string }));
                    setLocalTasks(tasks);
                    setErrorMsg(data.error || "Could not move task — change rolled back.");
                    setTimeout(() => setErrorMsg(null), 4000);
                } else {
                    // Fire-and-forget: parent refreshes side data without flicker.
                    onTaskUpdated();
                }
            } catch {
                setLocalTasks(tasks);
                setErrorMsg("Network error — task move rolled back.");
                setTimeout(() => setErrorMsg(null), 4000);
            }
        },
        [localTasks, tasks, token, onTaskUpdated]
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
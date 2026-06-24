import React from "react";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    DragCancelEvent,
    SensorDescriptor,
} from "@dnd-kit/core";
import { Task, User } from "../../types/index.js";

interface BoardWrapperProps {
    activeTask: Task | null;
    errorMsg: string | null;
    sensors: SensorDescriptor<any>[];
    handleDragStart: (event: DragStartEvent) => void;
    handleDragOver: (event: DragOverEvent) => void;
    handleDragEnd: (event: DragEndEvent) => void;
    handleDragCancel: (event: DragCancelEvent) => void;
    handleNativeDragOver: React.DragEventHandler<HTMLDivElement>;
    handleNativeDrop: React.DragEventHandler<HTMLDivElement>;
    users: User[];
    renderOverlay: (task: Task, users: User[]) => React.ReactNode;
    children: React.ReactNode;
}

export function BoardWrapper({
    activeTask,
    errorMsg,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    handleNativeDragOver,
    handleNativeDrop,
    users,
    renderOverlay,
    children,
}: BoardWrapperProps) {
    return (
        <div
            className="space-y-3"
            onDragOver={handleNativeDragOver}
            onDrop={handleNativeDrop}
        >
            {errorMsg && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
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
                {children}
                <DragOverlay
                    dropAnimation={{
                        duration: 200,
                        easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                    }}
                >
                    {activeTask ? renderOverlay(activeTask, users) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
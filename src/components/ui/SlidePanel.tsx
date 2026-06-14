/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface SlidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    overlay?: boolean;
}

const SIZE_CLASSES: Record<string, string> = {
    sm: "w-full max-w-sm",
    md: "w-full max-w-md",
    lg: "w-full max-w-lg",
    xl: "w-full max-w-2xl",
};

export function SlidePanel({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = "md",
    overlay = true,
}: SlidePanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && panelRef.current) {
            const first = panelRef.current.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            first?.focus();
        }
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                aria-hidden="true"
                onClick={onClose}
            />

            {/* Panel — inset-y-0 ensures it truly fills top-to-bottom */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`
                    fixed inset-y-0 right-0 z-50 flex flex-col
                    bg-white shadow-2xl border-l border-[#E8E8E8]
                    transform transition-transform duration-300 ease-in-out
                    ${SIZE_CLASSES[size]}
                    ${isOpen ? "translate-x-0" : "translate-x-full"}
                `}
            >
                {/* Header */}
                <div className="flex items-start justify-between px-5 py-4 border-b border-[#E8E8E8] bg-white shrink-0">
                    <div className="min-w-0 pr-3">
                        <h2 className="text-base font-semibold text-[#111111] truncate">{title}</h2>
                        {description && (
                            <p className="text-sm text-[#737373] mt-0.5">{description}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-[#737373] hover:text-[#111111] hover:bg-[#F4F4F4] rounded-lg transition-colors shrink-0"
                        aria-label="Close panel"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable body — flex-1 + overflow-y-auto fills remaining height */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {children}
                </div>
            </div>
        </>
    );
}
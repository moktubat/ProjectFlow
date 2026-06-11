/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Notification } from "../../types/index.js";
import { Bell, X, ArrowRight, MessageSquare, Briefcase, BookmarkCheck } from "lucide-react";

export function ToastNotificationManager() {
  const notifications = useUIStore((state) => state.notifications);
  const navigate = useUIStore((state) => state.navigate);
  const token = useUIStore((state) => state.token);
  const setNotifications = useUIStore((state) => state.setNotifications);

  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set<string>());
  const isMountedRef = useRef(false);

  // Initialize: mark current unread list as already notified so we only toast NEW incoming changes
  useEffect(() => {
    if (notifications.length > 0 && !isMountedRef.current) {
      notifications.forEach((n) => {
        if (!n.isRead) {
          notifiedIdsRef.current.add(n.id);
        }
      });
      isMountedRef.current = true;
    }
  }, [notifications]);

  // Hook into incoming notifications
  useEffect(() => {
    if (!isMountedRef.current && notifications.length > 0) {
      isMountedRef.current = true;
    }

    const unread = notifications.filter((n) => !n.isRead);
    const brandNew = unread.find((n) => !notifiedIdsRef.current.has(n.id));

    if (brandNew) {
      // Push into our notified set to hold off duplicates
      notifiedIdsRef.current.add(brandNew.id);
      setActiveToast(brandNew);

      // Dismiss automatically after 5.5 seconds
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 5500);

      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const handleDismiss = () => {
    setActiveToast(null);
  };

  const handleToastClick = async () => {
    if (!activeToast) return;
    const toastId = activeToast.id;
    const relatedId = activeToast.relatedProjectId;

    // Dismiss toast
    setActiveToast(null);

    // Call server to mark as read
    if (token) {
      try {
        const res = await fetch(`/api/notifications/${toastId}/read`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          // Re-fetch to sync
          const reload = await fetch("/api/notifications", {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (reload.ok) {
            setNotifications(await reload.json());
          }
        }
      } catch (e) {
        console.warn("Could not mark toast read:", e);
      }
    }

    // Redirect to project workspace if present
    if (relatedId) {
      navigate(`projects/${relatedId}`);
    } else {
      navigate("notifications");
    }
  };

  if (!activeToast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-sans flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      
      {/* Upper bar with action indicator/close */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/70">
        <div className="flex items-center space-x-1.5 text-[9.5px] font-mono font-bold uppercase tracking-wider text-indigo-400">
          <Bell className="w-3.5 h-3.5 animate-bounce" />
          <span>Live updates channels</span>
        </div>
        <button 
          onClick={handleDismiss}
          className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content wrapper */}
      <div 
        onClick={handleToastClick}
        className="p-4 flex items-start space-x-3.5 cursor-pointer hover:bg-slate-800/40 transition-colors"
      >
        <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 font-extrabold shrink-0 mt-0.5">
          {activeToast.message.includes("comment") ? (
            <MessageSquare className="w-4.5 h-4.5" />
          ) : activeToast.message.includes("document") || activeToast.message.includes("file") ? (
            <Briefcase className="w-4.5 h-4.5" />
          ) : (
            <BookmarkCheck className="w-4.5 h-4.5" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-white font-extrabold tracking-wide pr-3 line-clamp-2">
            {activeToast.message}
          </p>
          <span className="text-[9.5px] text-slate-400 font-mono tracking-wider flex items-center space-x-1.5 hover:text-indigo-300 transition-colors">
            <span>Manage source workspace</span>
            <ArrowRight className="w-3.5 h-3.5 inline" />
          </span>
        </div>
      </div>

      {/* Active slide progress bar helper */}
      <div className="h-1 bg-gradient-to-r from-theme-teal to-theme-purple animate-pulse" style={{ width: "100%" }} />

    </div>
  );
}

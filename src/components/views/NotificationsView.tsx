/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Notification } from "../../types/index.js";
import { Bell, CheckCircle2, BookmarkCheck, Calendar, Briefcase, AlertCircle } from "lucide-react";

export function NotificationsView() {
  const token = useUIStore((state) => state.token);
  const notifications = useUIStore((state) => state.notifications);
  const setNotifications = useUIStore((state) => state.setNotifications);
  const navigate = useUIStore((state) => state.navigate);

  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.warn("Could not reload notifications feed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string, relatedProjId?: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotifications();
        // Option redirection to project Workspace details
        if (relatedProjId) {
          navigate(`projects/${relatedProjId}`);
        }
      }
    } catch (err) {
      console.warn("Error marking read", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.warn("Error marking all read", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  const unreadList = notifications.filter(n => !n.isRead);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
      
      {/* Header Column */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Notification Center</h2>
          <p className="text-slate-500 text-xs mt-1">Review core dispatch records, assignments requests, and workspace updates</p>
        </div>
        {unreadList.length > 0 && (
          <div className="mt-4 sm:mt-0">
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              size="sm"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-600 border-slate-300"
            >
              <BookmarkCheck className="w-4 h-4 text-theme-teal" />
              <span>Mark All as Read</span>
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-purple mx-auto mb-2" />
          <span className="text-xs text-slate-400 font-medium font-mono">Syncing dispatch channel feed...</span>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 flex items-start justify-between transition-colors ${
                notif.isRead ? "bg-white/50" : "bg-teal-50/20 hover:bg-teal-50/30"
              }`}
            >
              <div className="flex items-start space-x-3.5 pr-4 flex-1">
                {/* Visual categorizer */}
                <div className={`p-2.5 rounded-lg flex-shrink-0 mt-0.5 ${
                  notif.type === "approval" 
                    ? "bg-purple-100/50 text-theme-purple" 
                    : "bg-sky-100/50 text-sky-600"
                }`}>
                  {notif.type === "approval" ? <BookmarkCheck className="w-4.5 h-4.5" /> : <Briefcase className="w-4.5 h-4.5" />}
                </div>

                <div className="space-y-1 overflow-hidden">
                  <p className={`text-xs pl-0.5 ${notif.isRead ? "text-slate-500" : "text-slate-800 font-extrabold"}`}>
                    {notif.message}
                  </p>
                  <p className="text-[10px] text-slate-400 pl-0.5 font-mono flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                    <span>{notif.createdAt ? notif.createdAt.replace("T", " ").substring(0, 16) : ""}</span>
                  </p>
                </div>
              </div>

              {!notif.isRead ? (
                <button
                  onClick={() => handleMarkAsRead(notif.id, notif.relatedProjectId)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 text-[10px] font-bold font-display rounded-lg shadow-2xs flex-shrink-0"
                >
                  Mark Read
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 font-mono font-bold mr-2 uppercase tracking-wider">
                  Read
                </span>
              )}
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="py-24 text-center text-slate-450 pr-4">
              <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">Dispatch channel is fully silent</p>
              <p className="text-[10px] text-slate-405 italic mt-0.5">You will receive logs here once actions occur.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

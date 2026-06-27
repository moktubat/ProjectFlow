import { useEffect, useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Bell, Briefcase, BookmarkCheck, Calendar } from "lucide-react";
import { Pagination } from "../ui/Pagination.js";
import { apiFetch } from "@/src/lib/api.js";

export function NotificationsView() {
  const notifications = useUIStore((s) => s.notifications);
  const setNotifications = useUIStore((s) => s.setNotifications);
  const navigate = useUIStore((s) => s.navigate);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Only fetches explicitly on user action (mark read), not on mount
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/notifications?page=${page}`);
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data ?? json);
        setTotalPages(json.pagination?.totalPages ?? 1);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, [page]);

  const markRead = async (id: string, projectId?: string) => {
    const res = await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
    if (res.ok) {
      await fetchNotifications();
      if (projectId) navigate(`projects/${projectId}`);
    }
  };

  const markAllRead = async () => {
    const res = await apiFetch("/api/notifications/read-all", { method: "POST" });
    if (res.ok) await fetchNotifications();
  };

  const unread = notifications.filter((n) => !n.isRead);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#E8E8E8] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Notifications</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {unread.length > 0 ? `${unread.length} unread` : "All caught up"}
          </p>
        </div>
        {unread.length > 0 && (
          <Button onClick={markAllRead} variant="outline" size="sm">
            <BookmarkCheck className="w-4 h-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl divide-y divide-[#F4F4F4] overflow-hidden">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3.5 px-5 py-4 transition-colors ${n.isRead ? "" : "bg-[#F7F8FA]"}`}
          >
            {/* Icon */}
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${n.type === "approval" ? "bg-primary-light text-[#0038BC]" : "bg-accent-light text-[#EF8F00]"}`}>
              {n.type === "approval" ? <BookmarkCheck className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${n.isRead ? "text-slate-600" : "text-[#111111] font-medium"}`}>
                {n.message}
              </p>
              <p className="text-xs text-[#A0A0A0] mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {n.createdAt?.replace("T", " ").substring(0, 16)}
              </p>
            </div>

            {/* Action */}
            {!n.isRead ? (
              <Button
                onClick={() => markRead(n.id, n.relatedProjectId)}
                variant="ghost"
                size="sm"
                className="shrink-0 text-[#0038BC] hover:bg-primary-light"
                disabled={isLoading}
              >
                Mark read
              </Button>
            ) : (
              <span className="text-xs text-[#A0A0A0] shrink-0 pt-1">Read</span>
            )}
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="w-10 h-10 text-[#D0D0D0] mb-3" />
            <p className="font-medium text-slate-600">No notifications</p>
            <p className="text-sm text-[#A0A0A0] mt-1">You'll be notified here when things happen.</p>
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
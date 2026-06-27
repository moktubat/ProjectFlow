import { useEffect, useState, useRef } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Notification } from "../../types/index.js";
import { Bell, X, ArrowRight } from "lucide-react";
import { apiFetch } from "@/src/lib/api.js";

export function ToastNotificationManager() {
  const notifications = useUIStore((s) => s.notifications);
  const navigate = useUIStore((s) => s.navigate);
  const setNotifications = useUIStore((s) => s.setNotifications);

  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const notifiedIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && notifications.length > 0) {
      notifications.forEach((n) => { if (!n.isRead) notifiedIds.current.add(n.id); });
      initialized.current = true;
    }
  }, [notifications]);

  useEffect(() => {
    if (!initialized.current) return;
    const newOne = notifications.filter((n) => !n.isRead).find((n) => !notifiedIds.current.has(n.id));
    if (!newOne) return;
    notifiedIds.current.add(newOne.id);
    setActiveToast(newOne);
    const t = setTimeout(() => setActiveToast(null), 5000);
    return () => clearTimeout(t);
  }, [notifications]);

  const handleClick = async () => {
    if (!activeToast) return;
    const { id, relatedProjectId } = activeToast;
    setActiveToast(null);
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
      const res = await apiFetch("/api/notifications");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data ?? json);
      }
    } catch { }
    navigate(relatedProjectId ? `projects/${relatedProjectId}` : "notifications");
  };

  if (!activeToast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 bg-white border border-[#E8E8E8] rounded-xl shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0038BC]">
        <div className="flex items-center gap-2 text-white text-xs font-medium">
          <Bell className="w-3.5 h-3.5" />
          <span>New notification</span>
        </div>
        <button onClick={() => setActiveToast(null)} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div onClick={handleClick} className="px-4 py-3 cursor-pointer hover:bg-[#F7F8FA] transition-colors">
        <p className="text-sm text-[#111111] line-clamp-2">{activeToast.message}</p>
        <span className="inline-flex items-center gap-1 text-xs text-[#0038BC] mt-1.5 font-medium">
          View <ArrowRight className="w-3 h-3" />
        </span>
      </div>
      <div className="h-0.5 bg-[#EF8F00] animate-pulse" />
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useUIStore } from "../store/ui-store.js";
import { Activity } from "../types/index.js";
import { PlusCircle, RefreshCw, CheckSquare, GitCommit, Trash2, MessageSquare, Paperclip, ArrowRight } from "lucide-react";

const ACTION_META: Record<string, { icon: React.ElementType; color: string }> = {
  project_created: { icon: PlusCircle, color: "text-green-600 bg-green-50" },
  project_updated: { icon: RefreshCw, color: "text-blue-600 bg-blue-50" },
  task_created: { icon: CheckSquare, color: "text-[#0038BC] bg-[#e8edfb]" },
  task_moved: { icon: ArrowRight, color: "text-indigo-600 bg-indigo-50" },
  task_trashed: { icon: Trash2, color: "text-red-600 bg-red-50" },
  project_trashed: { icon: Trash2, color: "text-red-600 bg-red-50" },
  comment_added: { icon: MessageSquare, color: "text-[#EF8F00] bg-[#fef3dc]" },
  file_uploaded: { icon: Paperclip, color: "text-teal-600 bg-teal-50" },
};

export function ActivityStream({ projectId }: { projectId: string }) {
  const token = useUIStore((s) => s.token);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async (silent = false) => {
    if (!token || !projectId) return;
    if (!silent) { setIsLoading(true); setError(null); }
    try {
      const res = await fetch(`/api/projects/${projectId}/activities`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setActivities(await res.json());
      else if (!silent) setError("Failed to load activity.");
    } catch { if (!silent) setError("Network error."); }
    finally { if (!silent) setIsLoading(false); }
  };

  useEffect(() => {
    fetchActivities();
    const iv = setInterval(() => fetchActivities(true), 12000);
    return () => clearInterval(iv);
  }, [projectId, token]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#111111]">Activity</p>
          <p className="text-xs text-[#737373] mt-0.5">Recent changes in this project</p>
        </div>
        <button
          onClick={() => fetchActivities()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#111111] px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] hover:bg-[#F4F4F4] transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 py-4">{error}</p>
      ) : activities.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-[#E8E8E8] rounded-xl">
          <GitCommit className="w-7 h-7 text-[#D0D0D0] mx-auto mb-2" />
          <p className="text-sm text-[#525252] font-medium">No activity yet</p>
          <p className="text-xs text-[#A0A0A0] mt-0.5">Actions will appear here as work progresses.</p>
        </div>
      ) : (
        <div className="flow-root max-h-80 overflow-y-auto">
          <ul className="-mb-6">
            {activities.map((a, idx) => {
              const meta = ACTION_META[a.action] ?? { icon: GitCommit, color: "text-[#737373] bg-[#F4F4F4]" };
              const Icon = meta.icon;
              return (
                <li key={a.id} className="relative pb-6">
                  {idx < activities.length - 1 && (
                    <span className="absolute left-4 top-8 -ml-px h-full w-px bg-[#E8E8E8]" />
                  )}
                  <div className="flex gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ring-2 ring-white ${meta.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-[#525252]">
                        <span className="font-semibold text-[#111111]">{a.userName}</span>{" "}
                        {a.details}
                      </p>
                      <p className="text-xs text-[#A0A0A0] mt-0.5">
                        {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
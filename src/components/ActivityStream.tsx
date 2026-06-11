import React, { useEffect, useState } from "react";
import { useUIStore } from "../store/ui-store.js";
import { Activity } from "../types/index.js";
import { 
  PlusCircle, 
  RefreshCw, 
  CheckSquare, 
  GitCommit, 
  Trash, 
  MessageSquare, 
  Paperclip, 
  Clock, 
  User,
  ArrowRight
} from "lucide-react";

interface ActivityStreamProps {
  projectId: string;
}

export function ActivityStream({ projectId }: ActivityStreamProps) {
  const token = useUIStore((state) => state.token);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async (isPoll = false) => {
    if (!token || !projectId) return;
    if (!isPoll) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/activities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data || []);
      } else if (!isPoll) {
        const err = await res.json();
        setError(err.error || "Failed to load project activity stream");
      }
    } catch (err) {
      if (!isPoll) {
        setError("Failed to fetch activity logs.");
      }
    } finally {
      if (!isPoll) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchActivities(false);
    const interval = setInterval(() => {
      fetchActivities(true);
    }, 12000); // Poll every 12s for newly minted collaborative actions
    return () => clearInterval(interval);
  }, [projectId, token]);

  const getActivityIcon = (action: string) => {
    switch (action) {
      case "project_created":
        return {
          icon: PlusCircle,
          bg: "bg-[#DAE9C6]",
          text: "text-slate-800"
        };
      case "project_updated":
        return {
          icon: RefreshCw,
          bg: "bg-[#FFF6F2]",
          text: "text-[#3B62AB]"
        };
      case "task_created":
        return {
          icon: CheckSquare,
          bg: "bg-[#FFF6F2]",
          text: "text-[#3B62AB]"
        };
      case "task_moved":
        return {
          icon: ArrowRight,
          bg: "bg-indigo-50",
          text: "text-indigo-600"
        };
      case "task_trashed":
      case "project_trashed":
        return {
          icon: Trash,
          bg: "bg-red-50",
          text: "text-red-500"
        };
      case "comment_added":
        return {
          icon: MessageSquare,
          bg: "bg-[#FFF6F2]",
          text: "text-[#3B62AB]"
        };
      case "file_uploaded":
        return {
          icon: Paperclip,
          bg: "bg-teal-50",
          text: "text-teal-600"
        };
      default:
        return {
          icon: GitCommit,
          bg: "bg-slate-100",
          text: "text-slate-500"
        };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Live Workspace Change Audit</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Real-time changelog tracking collaborative engineering actions</p>
        </div>
        <button
          onClick={() => fetchActivities(false)}
          disabled={isLoading}
          className="p-1 px-2.5 rounded-lg border border-slate-200/60 hover:bg-slate-50 transition-colors text-[10px] font-mono font-bold inline-flex items-center space-x-1 text-slate-500 active:scale-95 duration-100"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-[#3B62AB]" : ""}`} />
          <span>Sync</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400 font-medium space-y-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3B62AB] mx-auto" />
          <span>Synchronizing timeline...</span>
        </div>
      ) : error ? (
        <div className="py-8 text-center text-xs text-red-500 font-medium">
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-600">No actions logged yet</p>
          <p className="text-[10px] text-slate-400 mt-1">Actions on tasks, files, and updates will be audited here in real-time.</p>
        </div>
      ) : (
        <div className="flow-root max-h-96 overflow-y-auto pr-1">
          <ul className="-mb-8">
            {activities.map((activity, idx) => {
              const meta = getActivityIcon(activity.action);
              const Icon = meta.icon;
              return (
                <li key={activity.id}>
                  <div className="relative pb-8">
                    {idx !== activities.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-lg flex items-center justify-center ring-4 ring-white ${meta.bg}`}>
                          <Icon className={`w-4 h-4 ${meta.text}`} aria-hidden="true" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                        <div>
                          <p className="text-xs text-slate-600 font-medium">
                            <span className="font-extrabold text-slate-900 inline-flex items-center space-x-1 mr-1">
                              <User className="w-3.5 h-3.5 inline text-slate-400 mr-0.5" />
                              <span>{activity.userName}</span>
                            </span>
                            {activity.details}
                          </p>
                        </div>
                        <div className="text-right text-[10px] white-space-nowrap text-slate-400 font-mono tracking-wide">
                          {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
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

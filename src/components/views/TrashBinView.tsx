import React, { useEffect, useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Trash2, RotateCcw, Trash, AlertCircle, FileText, CheckSquare, Info } from "lucide-react";

interface TrashedProject { id: string; name: string; startDate: string; endDate: string; deletedAt?: string; }
interface TrashedTask { id: string; title: string; projectName?: string; category: string; deletedAt?: string; }

export default function TrashBinView() {
  const token = useUIStore((s) => s.token);
  const navigate = useUIStore((s) => s.navigate);
  const [projects, setProjects] = useState<TrashedProject[]>([]);
  const [tasks, setTasks] = useState<TrashedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "projects" | "tasks">("all");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch("/api/trash", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setProjects(d.projects ?? []); setTasks(d.tasks ?? []); }
      else setFeedback({ ok: false, msg: "Failed to load trash." });
    } catch { setFeedback({ ok: false, msg: "Network error." }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const restore = async (type: "project" | "task", id: string) => {
    if (!token) return;
    setActing(id); setFeedback(null);
    const r = await fetch(`/api/trash/restore/${type}/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setFeedback({ ok: r.ok, msg: d.message ?? d.error ?? "Done" });
    if (r.ok) load();
    setActing(null);
  };

  const purge = async (type: "project" | "task", id: string, name: string) => {
    if (!token || !confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    setActing(id); setFeedback(null);
    const r = await fetch(`/api/trash/delete/${type}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setFeedback({ ok: r.ok, msg: d.message ?? d.error ?? "Done" });
    if (r.ok) load();
    setActing(null);
  };

  const daysLeft = (s?: string) => {
    if (!s) return 15;
    return Math.max(0, 15 - Math.floor((Date.now() - new Date(s).getTime()) / 86400000));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E8E8E8] rounded-xl px-4 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#111111]">Trash</h2>
            <p className="text-sm text-[#737373] mt-0.5">Items are permanently deleted after 15 days</p>
          </div>
          <Button onClick={() => navigate("dashboard")} variant="outline" size="sm">Back to workspace</Button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
        <p>Deleting a project permanently also removes all its tasks, comments, and attached files from storage.</p>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${feedback.ok ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          <AlertCircle className="w-4 h-4 shrink-0" />{feedback.msg}
        </div>
      )}

      <div className="flex gap-1 bg-[#F4F4F4] p-1 rounded-xl w-fit">
        {(["all", "projects", "tasks"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${tab === t ? "bg-white text-[#111111] font-medium shadow-sm" : "text-[#737373] hover:text-[#111111]"}`}>
            {t === "all" ? `All (${projects.length + tasks.length})` : t === "projects" ? `Projects (${projects.length})` : `Tasks (${tasks.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {tab !== "tasks" && projects.length > 0 && (
            <div>
              <p className="text-sm font-medium text-[#111111] mb-2">Projects ({projects.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projects.map((p) => {
                  const d = daysLeft(p.deletedAt);
                  return (
                    <div key={p.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#737373]" />
                          <span className="text-xs text-[#737373]">Project</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${d <= 3 ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                          {d}d left
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#111111] mb-0.5">{p.name}</p>
                      <p className="text-xs text-[#A0A0A0] mb-3">Deleted {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString() : "—"}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => restore("project", p.id)} isLoading={acting === p.id}>
                          <RotateCcw className="w-3 h-3" /> Restore
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => purge("project", p.id, p.name)} isLoading={acting === p.id}>
                          <Trash className="w-3 h-3" /> Delete forever
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab !== "projects" && tasks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-[#111111] mb-2">Tasks ({tasks.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tasks.map((t) => {
                  const d = daysLeft(t.deletedAt);
                  return (
                    <div key={t.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="w-3.5 h-3.5 text-[#737373]" />
                          <span className="text-xs text-[#737373]">Task</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${d <= 3 ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                          {d}d left
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#111111] mb-0.5">{t.title}</p>
                      {t.projectName && <p className="text-xs text-[#737373] mb-0.5">Project: {t.projectName}</p>}
                      <p className="text-xs text-[#A0A0A0] mb-3">Deleted {t.deletedAt ? new Date(t.deletedAt).toLocaleDateString() : "—"}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => restore("task", t.id)} isLoading={acting === t.id}>
                          <RotateCcw className="w-3 h-3" /> Restore
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => purge("task", t.id, t.title)} isLoading={acting === t.id}>
                          <Trash className="w-3 h-3" /> Delete forever
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {((tab === "all" && projects.length === 0 && tasks.length === 0) ||
            (tab === "projects" && projects.length === 0) ||
            (tab === "tasks" && tasks.length === 0)) && (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-[#E8E8E8] rounded-xl">
                <Trash2 className="w-8 h-8 text-[#D0D0D0] mb-2" />
                <p className="text-sm text-[#525252]">Trash is empty</p>
                <p className="text-xs text-[#A0A0A0] mt-1">Nothing here waiting to be deleted.</p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
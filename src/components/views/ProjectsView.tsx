/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { useProjects } from "../../hooks/useProjects.js";
import { useUIStore } from "../../store/ui-store.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { SlidePanel } from "../ui/SlidePanel.js";
import { MarkdownEditor } from "../editor/MarkdownEditor.js";
import { Project, User, UserStatus, Task } from "../../types/index.js";
import {
  FolderKanban, Plus, Calendar, AlertCircle, Search, X,
  ArrowUpRight, CheckCircle2, ImageIcon, Check,
} from "lucide-react";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&q=80&w=600";

const STATUS_META: Record<Project["status"], { dot: string; glass: string; ring: string }> = {
  Planning: { dot: "bg-[#A0A0A0]", glass: "bg-white/15 border-white/25", ring: "#A0A0A0" },
  "In Progress": { dot: "bg-[#5B8DEF]", glass: "bg-[#0038BC]/30 border-[#5B8DEF]/40", ring: "#0038BC" },
  Review: { dot: "bg-[#FFCF85]", glass: "bg-[#EF8F00]/30 border-[#FFCF85]/40", ring: "#EF8F00" },
  Completed: { dot: "bg-emerald-400", glass: "bg-emerald-500/30 border-emerald-300/40", ring: "#16a34a" },
};

const PRIORITY_META: Record<Project["priority"], { glass: string }> = {
  Low: { glass: "bg-white/10 border-white/20" },
  Medium: { glass: "bg-[#EF8F00]/25 border-[#FFCF85]/35" },
  High: { glass: "bg-orange-500/30 border-orange-300/40" },
  Critical: { glass: "bg-red-500/35 border-red-300/45" },
};

const STATUS_FILTERS = ["All", "Planning", "In Progress", "Review", "Completed"] as const;

// ─── Small stat pill for the header ──────────────────────────────────────────
function StatPill({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 transition-colors ${accent ? "border-[#0038BC]/15 bg-[#e8edfb]" : "border-[#E8E8E8] bg-white"
        }`}
    >
      <span className={`font-mono text-base font-semibold ${accent ? "text-[#0038BC]" : "text-[#111111]"}`}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-[#A0A0A0]">{label}</span>
    </div>
  );
}

// ─── Animated radial progress, used on each card ─────────────────────────────
function ProgressRing({ value, color, size = 34 }: { value: number; color: string; size?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - ((mounted ? value : 0) / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEEEEE" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-semibold text-[#111111]">
        {value}
      </span>
    </div>
  );
}

// ─── Animated linear "flow" bar under the cover image ────────────────────────
function FlowBar({ pct, active }: { pct: number; active: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="h-[3px] w-full bg-[#F0F1F5]">
      <div
        className={`h-full bg-gradient-to-r from-[#0038BC] to-[#5B8DEF] transition-[width] duration-700 ease-out motion-reduce:transition-none ${active ? "motion-safe:animate-pulse" : ""
          }`}
        style={{ width: mounted ? `${pct}%` : "0%" }}
      />
    </div>
  );
}

export function ProjectsView() {
  usePageTitle("Projects", "Manage all your projects, deadlines, and teams in ProjectFlow.");

  const { projects, isLoading, error, refresh, createProject } = useProjects();
  const token = useUIStore((s) => s.token);
  const user = useUIStore((s) => s.user);
  const navigate = useUIStore((s) => s.navigate);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  // Search & filter — purely client-side, no backend changes required
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("All");

  const [projName, setProjName] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState<any>("Medium");
  const [status, setStatus] = useState<any>("Planning");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cloudinaryError, setCloudinaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/tasks", { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(async ([uRes, tRes]) => [
        uRes.ok ? await uRes.json() : [],
        tRes.ok ? await tRes.json() : [],
      ])
      .then(([userData, taskData]) => {
        setUsersList(userData.filter((u: User) => u.status === UserStatus.APPROVED));
        setAllTasks(taskData);
      })
      .catch(() => { });
  }, [token]);

  // Real completion stats per project, derived from tasks already in hand
  const projectStats = useMemo(() => {
    const map: Record<string, { total: number; done: number; pct: number }> = {};
    for (const p of projects) {
      const ts = allTasks.filter((t) => t.projectId === p.id && !t.deleted);
      const done = ts.filter((t) => t.status === "Done").length;
      map[p.id] = { total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 };
    }
    return map;
  }, [projects, allTasks]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.richTextDescription.replace(/<[^>]*>/g, "").toLowerCase().includes(q)
      );
    });
  }, [projects, query, statusFilter]);

  const activeCount = projects.filter((p) => p.status === "In Progress").length;
  const trackedProjects = projects.filter((p) => (projectStats[p.id]?.total ?? 0) > 0);
  const avgCompletion = trackedProjects.length
    ? Math.round(trackedProjects.reduce((s, p) => s + projectStats[p.id].pct, 0) / trackedProjects.length)
    : 0;

  const toggleMember = (id: string) =>
    setSelectedMembers((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const uploadCover = async (file: File) => {
    setIsUploading(true);
    setCloudinaryError(null);
    try {
      const reader = new FileReader();
      const b64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const r = await fetch("/api/cloudinary/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64Data: b64, filename: file.name }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setCoverUrl(data.url);
      if (data.simulated) setCloudinaryError("Simulation mode — placeholder image assigned.");
    } catch (err: any) {
      setCloudinaryError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setProjName(""); setCoverUrl(""); setDesc(""); setStartDate(""); setEndDate("");
    setPriority("Medium"); setStatus("Planning"); setSelectedMembers([]); setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !desc.trim() || !startDate || !endDate) {
      setFormError("Project name, description, and dates are required.");
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await createProject({
        name: projName,
        coverImageUrl: coverUrl || FALLBACK_COVER,
        richTextDescription: desc,
        startDate, endDate, priority, status,
        members: selectedMembers.length ? selectedMembers : user ? [user.id] : [],
      });
      resetForm();
      setIsPanelOpen(false);
      refresh();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SEL =
    "w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#0038BC]/10 focus:border-[#0038BC] transition-shadow";

  const hasActiveFilters = query.trim() !== "" || statusFilter !== "All";

  return (
    <div className="space-y-7">
      <style>{`
        @keyframes pf-fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes pf-shimmer { from { transform: translateX(-150%); } to { transform: translateX(150%); } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-xl border border-[#E8E8E8] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Projects</h2>
          <p className="text-sm text-[#737373] mt-0.5">Manage workspaces, deadlines, and teams</p>
        </div>
        <Button onClick={() => setIsPanelOpen(true)} variant="primary">
          <Plus className="w-4 h-4" />
          New project
        </Button>
      </div>

      {/* ── Content section: toolbar + project list, one cohesive card ─── */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 space-y-5">
        {/* Toolbar: search + filters */}
        <div className="flex flex-col gap-3 border-b border-[#F4F4F4] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2.5 justify-between sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A0A0A0]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                aria-label="Search projects"
                className="w-full rounded-xl border border-[#E8E8E8] bg-white py-2.5 pl-9 pr-9 text-sm text-[#111111] placeholder:text-[#A0A0A0] transition-shadow focus:outline-none focus:ring-4 focus:ring-[#0038BC]/10 focus:border-[#0038BC]"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#A0A0A0] transition-colors hover:bg-[#F4F4F4] hover:text-[#111111]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
              {STATUS_FILTERS.map((s) => {
                const active = statusFilter === s;
                const count = s === "All" ? projects.length : statusCounts[s] ?? 0;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    aria-pressed={active}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${active
                      ? "bg-[#0038BC] text-white shadow-sm shadow-[#0038BC]/30 border border-transparent"
                      : "border border-[#E8E8E8] bg-white text-[#525252] hover:border-[#0038BC]/30 hover:text-[#0038BC]"
                      }`}
                  >
                    {s}
                    <span className={`font-mono text-[10px] ${active ? "text-white/70" : "text-[#A0A0A0]"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <p className="text-xs text-[#737373]">
            {filteredProjects.length} match{filteredProjects.length !== 1 ? "es" : ""} found ·{" "}
            <button
              onClick={() => { setQuery(""); setStatusFilter("All"); }}
              className="font-medium text-[#0038BC] hover:underline"
            >
              Clear filters
            </button>
          </p>
        )}

        {/* Body */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white">
                <div className="relative h-36 overflow-hidden bg-[#F0F1F5]">
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent motion-safe:animate-[pf-shimmer_1.6s_ease-in-out_infinite]" />
                </div>
                <div className="space-y-3 p-5">
                  <div className="h-3 w-24 rounded-full bg-[#F0F1F5]" />
                  <div className="h-4 w-3/4 rounded-full bg-[#F0F1F5]" />
                  <div className="h-3 w-full rounded-full bg-[#F0F1F5]" />
                  <div className="h-3 w-5/6 rounded-full bg-[#F0F1F5]" />
                  <div className="flex items-center justify-between pt-3">
                    <div className="h-8 w-8 rounded-full bg-[#F0F1F5]" />
                    <div className="h-8 w-16 rounded-full bg-[#F0F1F5]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <span className="rounded-full bg-red-100 p-2"><AlertCircle className="h-4 w-4" /></span>
            <div>
              <p className="font-medium">Couldn't load projects</p>
              <p className="mt-0.5 text-red-600/90">{error}</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E8E8E8] py-24 text-center opacity-100 motion-safe:opacity-0 motion-safe:animate-[pf-fadeUp_0.5s_ease_forwards]">
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8edfb] to-[#dbe6fb]">
              <FolderKanban className="h-7 w-7 text-[#0038BC]" />
              <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#EF8F00] text-white shadow-md">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="text-base font-semibold text-[#111111]">Your workspace is empty</p>
            <p className="mt-1.5 max-w-sm text-sm text-[#A0A0A0]">
              Spin up your first project to start tracking tasks, deadlines, and how your team is moving.
            </p>
            <Button onClick={() => setIsPanelOpen(true)} variant="primary" className="mt-5">
              <Plus className="h-4 w-4" /> New project
            </Button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E8E8E8] py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F4F4]">
              <Search className="h-5 w-5 text-[#A0A0A0]" />
            </div>
            <p className="font-medium text-[#525252]">No projects match your search</p>
            <p className="mt-1 text-sm text-[#A0A0A0]">Try a different keyword or clear your filters.</p>
            <button
              onClick={() => { setQuery(""); setStatusFilter("All"); }}
              className="mt-4 text-sm font-medium text-[#0038BC] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((proj, idx) => {
              const stats = projectStats[proj.id] ?? { total: 0, done: 0, pct: 0 };
              const sMeta =
                STATUS_META[proj.status as keyof typeof STATUS_META] ??
                STATUS_META["Planning"];

              const pMeta =
                PRIORITY_META[proj.priority as keyof typeof PRIORITY_META] ??
                PRIORITY_META["Medium"];

              const overdue = proj.status !== "Completed" && new Date(proj.endDate) < new Date();
              const ringValue = stats.total ? stats.pct : proj.status === "Completed" ? 100 : 0;
              const barValue = stats.total ? stats.pct : proj.status === "Completed" ? 100 : 6;

              return (
                <button
                  key={proj.id}
                  onClick={() => navigate(`projects/${proj.id}`)}
                  style={{ animationDelay: `${Math.min(idx * 45, 360)}ms` }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white text-left opacity-100 transition-all duration-300 cursor-pointer hover:border-[#0038BC]/25 hover:shadow-[0_18px_40px_-12px_rgba(0,56,188,0.18)] motion-safe:opacity-0 motion-safe:animate-[pf-fadeUp_0.55s_ease_forwards]"
                >
                  {/* Media */}
                  <div className="relative h-36 overflow-hidden bg-[#111111]">
                    <img
                      src={proj.coverImageUrl || FALLBACK_COVER}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

                    <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md ${sMeta.glass}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${sMeta.dot} ${proj.status === "In Progress" ? "motion-safe:animate-pulse" : ""
                            }`}
                        />
                        {proj.status}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md ${pMeta.glass}`}>
                        {proj.priority}
                      </span>
                    </div>

                    <span className="absolute bottom-3 right-3 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full bg-white/90 text-[#0038BC] opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>

                  <FlowBar pct={barValue} active={proj.status === "In Progress"} />

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#A0A0A0]">
                      <Calendar className="h-3 w-3" />
                      {proj.startDate} → {proj.endDate}
                      {overdue && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                          Past due
                        </span>
                      )}
                    </div>

                    <h3 className="line-clamp-1 text-[15px] font-semibold text-[#111111] transition-colors group-hover:text-[#0038BC]">
                      {proj.name}
                    </h3>

                    <p className="line-clamp-2 text-sm leading-relaxed text-[#737373]">
                      {proj.richTextDescription.replace(/<[^>]*>/g, "") || "No description yet."}
                    </p>

                    <div className="mt-auto flex items-center justify-between border-t border-[#F4F4F4] pt-3.5">
                      <div className="flex items-center -space-x-2">
                        {(proj.members ?? []).slice(0, 4).map((mid) => {
                          const m = usersList.find((u) => u.id === mid);
                          return (
                            <div
                              key={mid}
                              title={m?.name ?? "Member"}
                              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#e8edfb] text-[10px] font-semibold text-[#0038BC]"
                            >
                              {m ? m.name.charAt(0).toUpperCase() : "?"}
                            </div>
                          );
                        })}
                        {(proj.members?.length ?? 0) > 4 && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#F4F4F4] text-[10px] font-semibold text-[#737373]">
                            +{proj.members!.length - 4}
                          </div>
                        )}
                        {(proj.members?.length ?? 0) === 0 && (
                          <span className="text-xs text-[#A0A0A0]">Unassigned</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {stats.total > 0 && (
                          <span className="font-mono text-[11px] text-[#A0A0A0]">{stats.done}/{stats.total}</span>
                        )}
                        <ProgressRing value={ringValue} color={sMeta.ring} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New project slide panel ───────────────────────────────────── */}
      <SlidePanel
        isOpen={isPanelOpen}
        onClose={() => { setIsPanelOpen(false); resetForm(); }}
        title="New project"
        description="Set the basics — you can fill in the rest later."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{formError}
            </div>
          )}

          <Input id="proj-title" label="Project name" placeholder="e.g. Q4 Cloud Migration" value={projName} onChange={(e) => setProjName(e.target.value)} required />

          {/* Cover image */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#3D3D3D]">Cover image</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadCover(f); }}
              onClick={() => document.getElementById("cover-upload-proj")?.click()}
              className="group relative flex h-28 cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed border-[#D0D0D0] transition-colors hover:border-[#0038BC]"
            >
              <input id="cover-upload-proj" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
              {coverUrl ? (
                <>
                  <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                  <div className="absolute inset-0 bg-black/35" />
                  <span className="relative z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Cover set — click to replace
                  </span>
                </>
              ) : isUploading ? (
                <span className="flex items-center gap-2 text-xs text-[#737373]">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0038BC] border-t-transparent" />
                  Uploading…
                </span>
              ) : (
                <div className="flex flex-col items-center text-[#A0A0A0] transition-colors group-hover:text-[#0038BC]">
                  <ImageIcon className="mb-1 h-5 w-5" />
                  <span className="text-xs">Drop an image, or click to browse</span>
                </div>
              )}
            </div>
            {cloudinaryError && <p className="mt-1 text-xs text-[#EF8F00]">{cloudinaryError}</p>}
            <Input label="Or paste a cover URL" placeholder="https://…" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="mt-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input id="proj-start" label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <Input id="proj-end" label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#3D3D3D]">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={SEL}>
                {["Planning", "In Progress", "Review", "Completed"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#3D3D3D]">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={SEL}>
                {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#3D3D3D]">Description</label>
            <MarkdownEditor value={desc} onChange={setDesc} placeholder="Describe the project goals and scope…" />
          </div>

          {/* Team members */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-[#3D3D3D]">Team members</label>
              {selectedMembers.length > 0 && (
                <span className="font-mono text-xs text-[#A0A0A0]">{selectedMembers.length} selected</span>
              )}
            </div>
            <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-[#E8E8E8] bg-[#F7F8FA] p-2">
              {usersList.map((u) => {
                const sel = selectedMembers.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleMember(u.id)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${sel
                      ? "bg-[#e8edfb] text-[#0038BC] ring-1 ring-inset ring-[#0038BC]/25"
                      : "border border-[#E8E8E8] bg-white text-[#3D3D3D] hover:bg-[#F4F4F4]"
                      }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${sel ? "bg-[#0038BC] text-white" : "bg-[#EEEEEE] text-[#737373]"
                        }`}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.name}</span>
                      <span className="text-xs text-[#737373]">{u.role}</span>
                    </span>
                    {sel && <Check className="h-3.5 w-3.5 shrink-0 text-[#0038BC]" />}
                  </button>
                );
              })}
              {usersList.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-[#A0A0A0]">No approved members yet.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#E8E8E8] pt-4">
            <Button type="button" variant="outline" onClick={() => { setIsPanelOpen(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>Create project</Button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
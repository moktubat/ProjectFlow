import { useState, useMemo } from "react";
import { Task, User, Project } from "../../types/index.js";
import { TrendingDown, Users, BarChart4, Clock, Zap, ShieldAlert, RefreshCw } from "lucide-react";

interface ProjectSprintAnalyticsProps {
  tasks: Task[];
  users: User[];
  project: Project;
}

export function ProjectSprintAnalytics({ tasks, users, project }: ProjectSprintAnalyticsProps) {
  const [tab, setTab] = useState<"burndown" | "workload" | "breakout">("burndown");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const active = useMemo(() => tasks.filter((t) => !t.deleted), [tasks]);

  const kpis = useMemo(() => {
    const total = active.length;
    const done = active.filter((t) => t.status === "Done").length;
    const est = active.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
    const logged = active.reduce((s, t) => s + t.timeLogs.reduce((a, l) => a + l.hours, 0), 0);
    const now = new Date();
    const overdue = active.filter((t) => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < now).length;
    return {
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      done, total, est, logged, overdue,
      velocity: (logged / 30).toFixed(1),
    };
  }, [active]);

  const statusData = useMemo(() => {
    const t = active.length || 1;
    return [
      { name: "To Do", count: active.filter((x) => x.status === "To Do").length, color: "#A0A0A0" },
      { name: "In Progress", count: active.filter((x) => x.status === "In Progress").length, color: "#0038BC" },
      { name: "Review", count: active.filter((x) => x.status === "Review").length, color: "#EF8F00" },
      { name: "Done", count: active.filter((x) => x.status === "Done").length, color: "#22c55e" },
    ].map((s) => ({ ...s, pct: Math.round((s.count / t) * 100) }));
  }, [active]);

  const burndown = useMemo(() => {
    let start = project.startDate ? new Date(project.startDate) : new Date();
    let end = project.endDate ? new Date(project.endDate) : new Date(Date.now() + 14 * 86400000);

    if (isNaN(start.getTime())) start = new Date();
    if (isNaN(end.getTime())) end = new Date(Date.now() + 14 * 86400000);

    let days = Math.ceil((end.getTime() - start.getTime()) / 86400000);

    if (days < 0) {
      [start, end] = [end, start];
      days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    }

    if (days <= 0) days = 1;

    if (days > 45) days = 45;

    const tot = active.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
    return Array.from({ length: days + 1 }, (_, i) => {
      const date = new Date(start.getTime() + i * 86400000).toISOString().split("T")[0];
      const ideal = parseFloat((tot * (1 - i / days)).toFixed(1));
      let actual = tot;
      active.forEach((t) => { if (t.status === "Done" && t.dueDate && t.dueDate <= date) actual -= (t.estimatedHours ?? 0); });
      return { i, date, ideal: Math.max(0, ideal), actual: Math.max(0, actual) };
    });
  }, [project, active]);

  const burnSvg = useMemo(() => {
    if (!burndown.length) return null;
    const W = 560, H = 240, P = 36;
    const maxH = Math.max(kpis.est || 10, ...burndown.map((d) => d.ideal));
    const gx = (i: number) => P + (i / (burndown.length - 1)) * (W - 2 * P);
    const gy = (h: number) => H - P - (h / maxH) * (H - 2 * P);
    const ideal = burndown.map((d, i) => `${i === 0 ? "M" : "L"}${gx(i)} ${gy(d.ideal)}`).join(" ");
    const actual = burndown.map((d, i) => `${i === 0 ? "M" : "L"}${gx(i)} ${gy(d.actual)}`).join(" ");
    const grids = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxH * f));
    return { W, H, P, gx, gy, ideal, actual, grids, maxH };
  }, [burndown, kpis.est]);

  const workloads = useMemo(() =>
    users.map((u) => {
      const mine = active.filter((t) => t.assignees.some((a) => a.userId === u.id));
      const done = mine.filter((t) => t.status === "Done").length;
      const est = mine.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
      const log = mine.reduce((s, t) => s + t.timeLogs.reduce((a, l) => a + l.hours, 0), 0);
      return { user: u, count: mine.length, donePct: mine.length > 0 ? Math.round((done / mine.length) * 100) : 0, est, log, overloaded: est >= 30 };
    }).sort((a, b) => b.est - a.est),
    [users, active]);

  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    active.forEach((t) => { map[t.category] = (map[t.category] ?? 0) + 1; });
    const tot = active.length || 1;
    return Object.entries(map).map(([cat, n]) => ({ cat, n, pct: Math.round((n / tot) * 100) })).sort((a, b) => b.n - a.n);
  }, [active]);

  const kpiCards = [
    { label: "Completion", value: `${kpis.pct}%`, sub: `${kpis.done}/${kpis.total} tasks`, icon: Zap, accent: false },
    { label: "Est. hours", value: `${kpis.est}h`, sub: `${kpis.logged}h logged`, icon: Clock, accent: false },
    { label: "Overdue", value: `${kpis.overdue}`, sub: "Past deadline", icon: ShieldAlert, accent: kpis.overdue > 0 },
    { label: "Velocity", value: `${kpis.velocity}h/d`, sub: "Avg daily rate", icon: RefreshCw, accent: false },
  ];

  const TABS = [
    { id: "burndown" as const, label: "Burndown", icon: TrendingDown },
    { id: "workload" as const, label: "Workload", icon: Users },
    { id: "breakout" as const, label: "Distribution", icon: BarChart4 },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, sub, icon: Icon, accent }) => (
          <div key={label} className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-[#737373]">{label}</p>
              <div className={`p-2 rounded-lg ${accent ? "bg-[#fef3dc]" : "bg-[#e8edfb]"}`}>
                <Icon className={`w-4 h-4 ${accent ? "text-[#EF8F00]" : "text-[#0038BC]"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${accent && kpis.overdue > 0 ? "text-red-600" : "text-[#111111]"}`}>{value}</p>
            <p className="text-xs text-[#A0A0A0] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <div className="flex border-b border-[#E8E8E8] px-4 pt-3 gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors -mb-px border-b-2 ${tab === id ? "border-[#0038BC] text-[#0038BC] font-semibold" : "border-transparent text-[#737373] hover:text-[#111111]"}`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Burndown */}
          {tab === "burndown" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Sprint Burndown</p>
                  <p className="text-xs text-[#737373] mt-0.5">Ideal vs actual remaining hours</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#737373]">
                  <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-[#D0D0D0] inline-block" /> Ideal</span>
                  <span className="flex items-center gap-1.5"><span className="w-6 h-1.5 bg-[#0038BC] rounded inline-block" /> Actual</span>
                </div>
              </div>

              {kpis.est === 0 ? (
                <p className="text-sm text-[#A0A0A0] py-10 text-center">Add estimated hours to tasks to see the burndown chart.</p>
              ) : burnSvg && (
                <div className="relative border border-[#E8E8E8] rounded-lg bg-[#F7F8FA] p-2">
                  <svg viewBox={`0 0 ${burnSvg.W} ${burnSvg.H}`} className="w-full h-auto">
                    {burnSvg.grids.map((h, i) => (
                      <g key={i}>
                        <line x1={burnSvg.P} y1={burnSvg.gy(h)} x2={burnSvg.W - burnSvg.P} y2={burnSvg.gy(h)} stroke="#E8E8E8" strokeWidth="1" />
                        <text x={burnSvg.P - 6} y={burnSvg.gy(h) + 4} fill="#A0A0A0" fontSize="10" textAnchor="end">{h}h</text>
                      </g>
                    ))}
                    <path d={burnSvg.ideal} fill="none" stroke="#D0D0D0" strokeWidth="1.5" strokeDasharray="4 3" />
                    <path d={burnSvg.actual} fill="none" stroke="#0038BC" strokeWidth="2.5" strokeLinecap="round" />
                    {burndown.map((d, i) => (
                      <circle key={i} cx={burnSvg.gx(i)} cy={burnSvg.gy(d.actual)} r={hoverIdx === i ? 6 : 3}
                        fill="#0038BC" stroke="white" strokeWidth="1.5"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} />
                    ))}
                  </svg>
                  {hoverIdx !== null && burndown[hoverIdx] && (
                    <div className="absolute top-3 left-10 bg-[#111111] text-white text-xs rounded-lg px-3 py-2 pointer-events-none space-y-0.5">
                      <p className="font-medium">Day {hoverIdx} · {burndown[hoverIdx].date}</p>
                      <p>Ideal: <span className="text-[#D0D0D0]">{burndown[hoverIdx].ideal}h</span></p>
                      <p>Actual: <span className="text-green-400">{burndown[hoverIdx].actual}h</span></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Workload */}
          {tab === "workload" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#111111]">Team Workload</p>
              <p className="text-xs text-[#737373]">Estimated hours per member. Over 30h may indicate overload.</p>
              {workloads.length === 0 ? <p className="text-sm text-[#A0A0A0]">No team members found.</p> : (
                <div className="space-y-3 mt-3">
                  {workloads.map(({ user, count, donePct, est, log, overloaded }) => (
                    <div key={user.id} className={`p-4 rounded-xl border ${overloaded ? "border-red-200 bg-red-50/30" : "border-[#E8E8E8] bg-[#F7F8FA]"}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${overloaded ? "bg-red-100 text-red-700" : "bg-[#e8edfb] text-[#0038BC]"}`}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#111111]">{user.name}</p>
                            <p className="text-xs text-[#737373]">{user.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#737373]">
                          <span>{count} tasks</span>
                          <span className={overloaded ? "text-red-600 font-semibold" : ""}>{est}h est.</span>
                          <span>{log}h logged</span>
                          {overloaded && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Overloaded</span>}
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-[#737373] mb-1">
                          <span>Progress</span><span>{donePct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#EEEEEE] rounded-full">
                          <div className={`h-full rounded-full ${overloaded ? "bg-red-500" : "bg-[#0038BC]"}`} style={{ width: `${donePct}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Breakout */}
          {tab === "breakout" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-sm font-semibold text-[#111111] mb-3">Status breakdown</p>
                <div className="space-y-3">
                  {statusData.map((s) => (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                        <span className="text-[#737373]">{s.count} ({s.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-[#EEEEEE] rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t md:border-t-0 md:border-l border-[#E8E8E8] pt-4 md:pt-0 md:pl-8">
                <p className="text-sm font-semibold text-[#111111] mb-3">By category</p>
                {catData.length === 0 ? <p className="text-sm text-[#A0A0A0]">No tasks yet.</p> : (
                  <div className="space-y-3">
                    {catData.map(({ cat, n, pct }) => (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{cat}</span>
                          <span className="text-[#737373]">{n} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-[#EEEEEE] rounded-full">
                          <div className="h-full bg-[#0038BC] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
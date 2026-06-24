import React, { useState, useEffect } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { User, Role, UserStatus } from "../../types/index.js";
import { ShieldCheck, Sparkles, AlertCircle, Link, Copy, Check, Trash2, Clock } from "lucide-react";
import { Pagination } from "../ui/Pagination.js";

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-50 text-green-700 border border-green-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  REJECTED: "bg-red-50 text-red-700 border border-red-200",
  INACTIVE: "bg-[#F4F4F4] text-[#737373] border border-[#E8E8E8]",
};

const SEL = "px-2 py-1 border border-[#D0D0D0] bg-white rounded-lg text-xs focus:outline-none focus:border-[#0038BC]";

export function UsersApprovalView() {
  const token = useUIStore((s) => s.token);
  const self = useUIStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"directory" | "invitations">("directory");

  const [invites, setInvites] = useState<any[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invRole, setInvRole] = useState<Role>(Role.JUNIOR);
  const [invTeam, setInvTeam] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [invLimit, setInvLimit] = useState(1);
  const [invPlan, setInvPlan] = useState<"Free" | "Paid" | "Enterprise">("Free");
  const [copied, setCopied] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const [uR, tR] = await Promise.all([
      fetch(`/api/users?page=${page}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (uR.ok) {
      const uJ = await uR.json();
      setUsers(uJ.data ?? uJ);
      setTotalPages(uJ.pagination?.totalPages ?? 1);
    } else {
      const d = await uR.json();
      setErr(d.error);
    }

    if (tR.ok) setTeams(await tR.json());
    setLoading(false);
  };

  const loadInvites = async () => {
    if (!token) return;
    setInvLoading(true);
    const r = await fetch("/api/invitations", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setInvites(await r.json());
    setInvLoading(false);
  };

  useEffect(() => {
    load();
    loadInvites();
  }, [token, page]);

  const updateStatus = async (id: string, status: UserStatus) => {
    const res = await fetch(`/api/users/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) });
    if (res.ok) load(); else { const d = await res.json(); alert(d.error); }
  };

  const updateRole = async (id: string, role: Role) => {
    const res = await fetch(`/api/users/${id}/role`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ role }) });
    if (res.ok) load(); else { const d = await res.json(); alert(d.error); }
  };

  const updateTeam = async (id: string, teamId: string) => {
    const res = await fetch(`/api/users/${id}/details`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ teamId }) });
    if (res.ok) load(); else { const d = await res.json(); alert(d.error); }
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const teamName = teams.find((t) => t.id === invTeam)?.name;
    const res = await fetch("/api/invitations", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: invEmail || undefined, role: invRole, teamId: invTeam || undefined, teamName: teamName || undefined, usedLimit: invLimit, plan: invPlan }),
    });
    if (res.ok) { setInvEmail(""); setInvTeam(""); loadInvites(); }
    else { const d = await res.json(); alert(d.error); }
  };

  const revokeInvite = async (id: string) => {
    if (!confirm("Revoke this invitation?")) return;
    const res = await fetch(`/api/invitations/${id}/revoke`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) loadInvites(); else { const d = await res.json(); alert(d.error); }
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${location.origin}/#/register?inviteToken=${id}`);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  const canAdmin = self && [Role.SUPER_ADMIN, Role.ADMIN].includes(self.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E8E8E8] rounded-xl px-4 py-3.5">
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Access management</h2>
          <p className="text-sm text-[#737373] mt-0.5">Manage users, roles, and invitations</p>
        </div>
        <Button onClick={tab === "directory" ? load : loadInvites} variant="outline" size="sm">Refresh</Button>
      </div>

      <div className="flex gap-1 bg-[#F4F4F4] p-1 rounded-xl w-fit">
        {(["directory", "invitations"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${tab === t ? "bg-white text-[#111111] font-medium shadow-sm" : "text-[#737373] hover:text-[#111111]"}`}>
            {t === "directory" ? `Members (${users.length})` : `Invitations (${invites.length})`}
          </button>
        ))}
      </div>

      {tab === "directory" && (
        <>
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" /></div>
          ) : err ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{err}
            </div>
          ) : (
            <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F8FA] border-b border-[#E8E8E8] text-xs text-[#737373]">
                      <th className="px-4 py-3 text-left font-medium">User</th>
                      <th className="px-4 py-3 text-left font-medium">Email</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-left font-medium">Team</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F4F4]">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F7F8FA] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#e8edfb] text-[#0038BC] text-sm font-medium flex items-center justify-center shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm text-[#111111]">{u.name}</p>
                              <p className="text-xs text-[#A0A0A0]">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#737373]">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_STYLES[u.status] ?? STATUS_STYLES.INACTIVE}`}>{u.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {canAdmin && u.id !== self?.id ? (
                            <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value as Role)} className={SEL}>
                              {Object.values(Role).map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          ) : <span className="text-xs text-[#737373]">{u.role}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {canAdmin ? (
                            <select value={u.teamId ?? "none"} onChange={(e) => updateTeam(u.id, e.target.value)} className={SEL}>
                              <option value="none">No team</option>
                              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          ) : <span className="text-xs text-[#737373]">{teams.find((t) => t.id === u.teamId)?.name ?? "—"}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {u.id !== self?.id ? (
                              <>
                                {u.status !== UserStatus.APPROVED && (
                                  <Button onClick={() => updateStatus(u.id, UserStatus.APPROVED)} variant="primary" size="sm">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Approve
                                  </Button>
                                )}
                                {u.status === UserStatus.APPROVED && (
                                  <Button onClick={() => updateStatus(u.id, UserStatus.INACTIVE)} variant="outline" size="sm">Deactivate</Button>
                                )}
                                {u.status === UserStatus.PENDING && (
                                  <Button onClick={() => updateStatus(u.id, UserStatus.REJECTED)} variant="danger" size="sm">Deny</Button>
                                )}
                              </>
                            ) : <span className="text-xs text-[#A0A0A0]">You</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#A0A0A0]">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {tab === "invitations" && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Link className="w-3.5 h-3.5 text-[#0038BC]" />
              <p className="text-sm font-medium text-[#111111]">Generate invitation link</p>
            </div>
            <form onSubmit={createInvite} className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-[#737373] mb-1">Role</label>
                  <select value={invRole} onChange={(e) => setInvRole(e.target.value as Role)}
                    className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#0038BC]">
                    {Object.values(Role).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#737373] mb-1">Team</label>
                  <select value={invTeam} onChange={(e) => setInvTeam(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#0038BC]">
                    <option value="">No team</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#737373] mb-1">Uses</label>
                  <select value={invLimit} onChange={(e) => setInvLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#0038BC]">
                    <option value={1}>1 use</option><option value={5}>5 uses</option>
                    <option value={10}>10 uses</option><option value={0}>Unlimited</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#737373] mb-1">Plan</label>
                  <select value={invPlan} onChange={(e) => setInvPlan(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#0038BC]">
                    <option>Free</option><option>Paid</option><option>Enterprise</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#737373] mb-1">Email (optional)</label>
                <input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="recruit@company.com"
                  className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC]" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  <Sparkles className="w-3.5 h-3.5" /> Generate 7-day link
                </Button>
              </div>
            </form>
          </div>

          <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E8E8E8] bg-[#F7F8FA] flex items-center justify-between">
              <p className="text-sm font-medium text-[#111111]">Invitations</p>
              <span className="text-xs text-[#737373]">{invites.length} total</span>
            </div>
            {invLoading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" /></div>
            ) : invites.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-[#A0A0A0]">No invitations yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F8FA] border-b border-[#E8E8E8] text-xs text-[#737373]">
                      <th className="px-4 py-3 text-left font-medium">Token</th>
                      <th className="px-4 py-3 text-left font-medium">Role / Team</th>
                      <th className="px-4 py-3 text-left font-medium">Usage</th>
                      <th className="px-4 py-3 text-left font-medium">Expires</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F4F4]">
                    {invites.map((inv) => {
                      const expired = new Date(inv.expiresAt) < new Date() || inv.status !== "active";
                      return (
                        <tr key={inv.id} className={`hover:bg-[#F7F8FA] transition-colors ${expired ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-[#F4F4F4] px-2 py-0.5 rounded font-mono">{inv.id}</code>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs bg-[#e8edfb] text-[#0038BC] px-2 py-0.5 rounded-md">{inv.role}</span>
                              {inv.teamName && <span className="text-xs bg-[#fef3dc] text-[#9a5b00] px-2 py-0.5 rounded-md">{inv.teamName}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#737373]">{inv.usedCount} / {inv.usedLimit === 0 ? "∞" : inv.usedLimit}</td>
                          <td className="px-4 py-3">
                            {expired ? (
                              <span className="flex items-center gap-1 text-xs text-red-600"><Clock className="w-3 h-3" />Expired</span>
                            ) : (
                              <span className="text-xs text-[#737373]">{new Date(inv.expiresAt).toLocaleDateString()}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {!expired && (
                                <>
                                  <button onClick={() => copyLink(inv.id)} className="flex items-center gap-1 text-xs text-[#0038BC] hover:underline">
                                    {copied === inv.id ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                                  </button>
                                  <button onClick={() => revokeInvite(inv.id)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
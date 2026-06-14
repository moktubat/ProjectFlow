/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { SlidePanel } from "../ui/SlidePanel.js";
import { Team, User, Role } from "../../types/index.js";
import { Users, Plus, Trash2, AlertCircle, UsersRound } from "lucide-react";

export function TeamsView() {
  usePageTitle("Teams", "Manage your workspace teams and assign members to squads in ProjectFlow.");

  const token = useUIStore((s) => s.token);
  const user  = useUIStore((s) => s.user);
  const [teams, setTeams]   = useState<Team[]>([]);
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [name, setName]     = useState("");
  const [desc, setDesc]     = useState("");
  const [leadId, setLeadId] = useState("");
  const [err, setErr]       = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const [tR, uR] = await Promise.all([
      fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (tR.ok) setTeams(await tR.json());
    if (uR.ok) setUsers(await uR.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const resetForm = () => { setName(""); setDesc(""); setLeadId(""); setErr(null); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !leadId) { setErr("Name and team lead are required."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description: desc, leadId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      resetForm();
      setIsPanelOpen(false);
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Disband this team? Members will become unassigned.")) return;
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) load(); else { const d = await res.json(); alert(d.error); }
  };

  const canManage = user && [Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER].includes(user.role);
  const getLeadName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  const SEL = "w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/10 focus:border-[#0038BC]";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E8E8E8] rounded-xl px-4 py-3.5">
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Teams</h2>
          <p className="text-sm text-[#737373] mt-0.5">Organize members into teams</p>
        </div>
        {canManage && (
          <Button onClick={() => setIsPanelOpen(true)} variant="primary" size="sm">
            <Plus className="w-3.5 h-3.5" /> New team
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <div key={t.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#e8edfb] rounded-lg">
                    <Users className="w-3.5 h-3.5 text-[#0038BC]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#111111]">{t.name}</h3>
                </div>
                {canManage && (
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 text-[#A0A0A0] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-[#737373] mb-4 line-clamp-2 min-h-[2.5rem]">{t.description || "No description."}</p>
              <div className="flex items-center justify-between pt-3 border-t border-[#E8E8E8]">
                <div>
                  <p className="text-xs text-[#A0A0A0]">Lead</p>
                  <p className="text-sm text-[#111111]">{getLeadName(t.leadId)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#A0A0A0]">Members</p>
                  <p className="text-sm font-medium text-[#0038BC]">{t.membersCount}</p>
                </div>
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 border-2 border-dashed border-[#E8E8E8] rounded-xl">
              <UsersRound className="w-8 h-8 text-[#D0D0D0] mb-2" />
              <p className="text-sm text-[#525252]">No teams yet</p>
              <p className="text-xs text-[#A0A0A0] mt-1">Create a team to organize your members.</p>
            </div>
          )}
        </div>
      )}

      {/* New team slide panel */}
      <SlidePanel
        isOpen={isPanelOpen}
        onClose={() => { setIsPanelOpen(false); resetForm(); }}
        title="New team"
        description="Create a team and assign a lead."
        size="sm"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {err && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{err}
            </div>
          )}
          <Input label="Team name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frontend team" required />
          <div>
            <label className="block text-xs text-[#737373] mb-1">Description</label>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What does this team work on?"
              className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm placeholder:text-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#0038BC]/10 focus:border-[#0038BC] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-[#737373] mb-1">Team lead *</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required className={SEL}>
              <option value="">Select a lead…</option>
              {users.filter((u) => u.status === "APPROVED").map((u) => (
                <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8]">
            <Button type="button" variant="outline" onClick={() => { setIsPanelOpen(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={busy}>Create team</Button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
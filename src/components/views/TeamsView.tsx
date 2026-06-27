import React, { useState, useEffect } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { SlidePanel } from "../ui/SlidePanel.js";
import { Team, User, Role } from "../../types/index.js";
import { Users, Plus, Trash2, AlertCircle, UsersRound, Pencil } from "lucide-react";
import { apiFetch } from "@/src/lib/api.js";

export function TeamsView() {
  usePageTitle("Teams", "Manage your workspace teams and assign members to squads in ProjectFlow.");

  const user = useUIStore((s) => s.user);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [leadId, setLeadId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Edit panel
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLeadId, setEditLeadId] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");
  const [memberBusy, setMemberBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [tR, uR] = await Promise.all([
      apiFetch("/api/teams"),
      apiFetch("/api/users"),
    ]);
    if (tR.ok) setTeams(await tR.json());
    if (uR.ok) {
      const uJ = await uR.json();
      setUsers(uJ.data ?? uJ);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setName(""); setDesc(""); setLeadId(""); setErr(null); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !leadId) { setErr("Name and team lead are required."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const res = await apiFetch(`/api/teams/${id}`, { method: "DELETE" });
    if (res.ok) load(); else { const d = await res.json(); alert(d.error); }
  };

  const canManage = user && [Role.SUPER_ADMIN, Role.ADMIN, Role.PROJECT_MANAGER].includes(user.role);
  const getLeadName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  // ── Edit panel logic ──
  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setEditName(team.name);
    setEditDesc(team.description || "");
    setEditLeadId(team.leadId);
    setEditErr(null);
    setAddMemberId("");
  };

  const closeEdit = () => {
    setEditingTeam(null);
    setEditErr(null);
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    if (!editName.trim() || !editLeadId) { setEditErr("Name and team lead are required."); return; }
    setEditBusy(true); setEditErr(null);
    try {
      const res = await apiFetch(`/api/teams/${editingTeam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc, leadId: editLeadId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const updated = await res.json();
      setEditingTeam(updated);
      load();
    } catch (e: any) { setEditErr(e.message); }
    finally { setEditBusy(false); }
  };

  const refreshUsers = async () => {
    const refreshed = await apiFetch("/api/users");
    if (refreshed.ok) {
      const uJ = await refreshed.json();
      setUsers(uJ.data ?? uJ);
    }
  };

  const addMember = async (uid: string) => {
    if (!editingTeam || !uid) return;
    setMemberBusy(uid);
    try {
      const res = await apiFetch(`/api/users/${uid}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: editingTeam.id }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await refreshUsers();
      setAddMemberId("");
      load();
    } catch (e: any) { setEditErr(e.message); }
    finally { setMemberBusy(null); }
  };

  const removeMember = async (uid: string) => {
    if (!editingTeam) return;
    if (!confirm("Remove this member from the team?")) return;
    setMemberBusy(uid);
    try {
      const res = await apiFetch(`/api/users/${uid}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: "none" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await refreshUsers();
      load();
    } catch (e: any) { setEditErr(e.message); }
    finally { setMemberBusy(null); }
  };

  const SEL = "w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0038BC]/10 focus:border-[#0038BC]";

  const teamMembers = editingTeam ? users.filter((u) => u.teamId === editingTeam.id) : [];
  const nonMembers = editingTeam ? users.filter((u) => u.status === "APPROVED" && u.teamId !== editingTeam.id) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E8E8E8] rounded-xl px-4 py-3.5">
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Teams</h2>
          <p className="text-sm text-slate-500 mt-0.5">Organize members into teams</p>
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
                  <div className="p-2 bg-primary-light rounded-lg">
                    <Users className="w-3.5 h-3.5 text-[#0038BC]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#111111]">{t.name}</h3>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(t)} className="p-1.5 text-[#A0A0A0] hover:text-[#0038BC] hover:bg-primary-light rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 text-[#A0A0A0] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2 min-h-10">{t.description || "No description."}</p>
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
              <p className="text-sm text-slate-600">No teams yet</p>
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
            <label className="block text-xs text-slate-500 mb-1">Description</label>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What does this team work on?"
              className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm placeholder:text-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#0038BC]/10 focus:border-[#0038BC] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Team lead *</label>
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

      {/* Edit team slide panel */}
      <SlidePanel
        isOpen={!!editingTeam}
        onClose={closeEdit}
        title="Edit team"
        description={editingTeam ? `Manage details and members for ${editingTeam.name}` : undefined}
        size="lg"
      >
        {editingTeam && (
          <div className="space-y-5">
            {editErr && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{editErr}
              </div>
            )}

            <form onSubmit={handleUpdateTeam} className="space-y-4">
              <Input label="Team name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              <div>
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <textarea rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D0D0D0] rounded-lg text-sm placeholder:text-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#0038BC]/10 focus:border-[#0038BC] resize-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Team lead *</label>
                <select value={editLeadId} onChange={(e) => setEditLeadId(e.target.value)} required className={SEL}>
                  {users.filter((u) => u.status === "APPROVED").map((u) => (
                    <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="submit" variant="primary" isLoading={editBusy}>Save changes</Button>
              </div>
            </form>

            <div className="pt-4 border-t border-[#E8E8E8]">
              <p className="text-sm font-medium text-[#111111] mb-2">Members ({teamMembers.length})</p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {teamMembers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2.5 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm text-[#111111] font-medium truncate">
                        {u.name}
                        {u.id === editingTeam.leadId && <span className="ml-1.5 text-xs text-[#0038BC] font-normal">(Lead)</span>}
                      </p>
                      <p className="text-xs text-slate-500">@{u.username}</p>
                    </div>
                    <button
                      onClick={() => removeMember(u.id)}
                      disabled={memberBusy === u.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {memberBusy === u.id
                        ? <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
                {teamMembers.length === 0 && (
                  <p className="text-sm text-[#A0A0A0] text-center py-3">No members in this team yet.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[#111111] mb-2">Add member</p>
              <div className="flex gap-2">
                <select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} className={SEL}>
                  <option value="">Select a user…</option>
                  {nonMembers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!addMemberId || memberBusy === addMemberId}
                  isLoading={memberBusy === addMemberId}
                  onClick={() => addMember(addMemberId)}
                >
                  Add
                </Button>
              </div>
              {nonMembers.length === 0 && (
                <p className="text-xs text-[#A0A0A0] mt-2">All approved users are already in this team.</p>
              )}
            </div>
          </div>
        )}
      </SlidePanel>
    </div>
  );
}
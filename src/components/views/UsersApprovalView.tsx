/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { User, Role, UserStatus } from "../../types/index.js";
import { 
  ShieldCheck, 
  UserMinus, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles, 
  AlertCircle,
  Link,
  Calendar,
  Copy,
  Check,
  Trash2,
  Users,
  Shield,
  Clock,
  Sparkle
} from "lucide-react";

export function UsersApprovalView() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const token = useUIStore((state) => state.token);
  const loggedInUser = useUIStore((state) => state.user);

  const fetchUsers = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (uRes.ok) {
        const data = await uRes.json();
        setUsersList(data);
      } else {
        const data = await uRes.json();
        setError(data.error || "Failed to load profiles list.");
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        setTeamsList(tData);
      }
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: string, targetStatus: UserStatus) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const d = await res.json();
        alert(`Error: ${d.error}`);
      }
    } catch {
      alert("Failed to reach server.");
    }
  };

  const handleUpdateRole = async (userId: string, targetRole: Role) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: targetRole })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const d = await res.json();
        alert(`Error shifting role: ${d.error}`);
      }
    } catch {
      alert("Failed to change user's system role.");
    }
  };

  const handleUpdateTeam = async (userId: string, targetTeamId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/users/${userId}/details`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ teamId: targetTeamId })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const d = await res.json();
        alert(`Error shifting team: ${d.error}`);
      }
    } catch {
      alert("Failed to update user team assignment.");
    }
  };

  // --- INVITATIONS MANAGEMENT LOGIC ---
  const [activeTab, setActiveTab] = useState<"directory" | "invitations">("directory");
  const [invitationsList, setInvitationsList] = useState<any[]>([]);
  const [isInvitationsLoading, setIsInvitationsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>(Role.JUNIOR);
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [inviteUsedLimit, setInviteUsedLimit] = useState(1); // 1 = Single use, 0/unlimited
  const [invitePlan, setInvitePlan] = useState<"Free" | "Paid" | "Enterprise">("Free");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchInvitations = async () => {
    if (!token) return;
    setIsInvitationsLoading(true);
    try {
      const res = await fetch("/api/invitations", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvitationsList(data);
      }
    } catch (e) {
      console.error("Failed to load invitations list", e);
    } finally {
      setIsInvitationsLoading(false);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const teamName = teamsList.find(t => t.id === inviteTeamId)?.name;
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: inviteEmail || undefined,
          role: inviteRole,
          teamId: inviteTeamId || undefined,
          teamName: teamName || undefined,
          usedLimit: Number(inviteUsedLimit),
          plan: invitePlan
        })
      });
      if (res.ok) {
        setInviteEmail("");
        setInviteTeamId("");
        setInviteRole(Role.JUNIOR);
        setInviteUsedLimit(1);
        fetchInvitations();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || "Could not generate link"}`);
      }
    } catch {
      alert("Unexpected network error while creating invitation.");
    }
  };

  const handleRevokeInvitation = async (inviteId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to revoke this invitation token immediately? Candidates will no longer be able to activate accounts with it.")) return;
    try {
      const res = await fetch(`/api/invitations/${inviteId}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchInvitations();
      } else {
        const d = await res.json();
        alert(`Failed to revoke: ${d.error}`);
      }
    } catch {
      alert("Failed to communicate with central workspace.");
    }
  };

  const handleCopyLink = (tokenId: string) => {
    const signupUrl = `${window.location.protocol}//${window.location.host}/#/register?inviteToken=${tokenId}`;
    navigator.clipboard.writeText(signupUrl).then(() => {
      setCopiedToken(tokenId);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
  }, [token]);

  // Roles available for allocation
  const rolesOptions = Object.values(Role);

  const getStatusBadge = (st: UserStatus) => {
    switch (st) {
      case UserStatus.APPROVED:
        return "bg-emerald-50 text-emerald-700 border-emerald-200/60 text-[10px] font-bold";
      case UserStatus.PENDING:
        return "bg-amber-50 text-amber-700 border-amber-200/60 text-[10px] font-bold animate-pulse";
      case UserStatus.REJECTED:
        return "bg-rose-50 text-rose-700 border-rose-200/60 text-[10px] font-bold";
      case UserStatus.INACTIVE:
        return "bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-bold";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display font-sans">Workspace Directory & Accounts</h2>
          <p className="text-slate-500 text-xs mt-1">Audit active directory profiles, manage registrations, and generate secure invite tokens</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={activeTab === "directory" ? fetchUsers : fetchInvitations} variant="outline" size="sm" className="font-mono text-xs">
            Reload {activeTab === "directory" ? "Roster" : "Invitations"}
          </Button>
        </div>
      </div>

      {/* Interactive Tabs Menu */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-2xl shadow-2xs border border-slate-200/80 space-x-1">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex-1 sm:flex-none text-center px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
            activeTab === "directory"
              ? "bg-slate-900 text-white font-extrabold shadow-xs"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          📂 Active Member Directory ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`flex-1 sm:flex-none text-center px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
            activeTab === "invitations"
              ? "bg-slate-900 text-white font-extrabold shadow-xs"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          ✉️ Workspace Invitations Hub ({invitationsList.length})
        </button>
      </div>

      {activeTab === "directory" ? (
        error ? (
          <div className="bg-pink-50 border border-pink-100 rounded-lg p-4 text-theme-pink text-sm flex items-center space-x-2">
            <span>{error}</span>
          </div>
        ) : isLoading ? (
          <div className="py-24 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto mb-2" />
            <span className="text-xs text-slate-400 font-medium font-mono">Fetching register dataset...</span>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm text-slate-700">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">Full Name / Profile</th>
                    <th className="p-4">Username</th>
                    <th className="p-4">Email Address</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">System Role RBAC</th>
                    <th className="p-4">Squad / Team</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {usersList.map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* User profile identifier */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-theme-blue/10 border border-theme-blue/20 text-theme-blue flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                            {usr.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 leading-snug">{usr.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-wide">ID: {usr.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-mono font-semibold text-slate-600">
                        @{usr.username}
                      </td>

                      <td className="p-4 text-slate-500 font-medium font-mono">
                        {usr.email}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[9px] ${getStatusBadge(usr.status)}`}>
                          {usr.status}
                        </span>
                      </td>

                      {/* Allot core group roles */}
                      <td className="p-4">
                        {loggedInUser && (loggedInUser.role === Role.SUPER_ADMIN || loggedInUser.role === Role.ADMIN) ? (
                          <select
                            value={usr.role}
                            disabled={usr.id === loggedInUser.id} // cannot change own role
                            onChange={(e) => handleUpdateRole(usr.id, e.target.value as Role)}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 text-[11px] font-mono font-semibold text-slate-700 disabled:opacity-50"
                          >
                            {rolesOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-sm">
                            {usr.role}
                          </span>
                        )}
                      </td>

                      {/* Team assignment dropdown */}
                      <td className="p-4">
                        {loggedInUser && (loggedInUser.role === Role.SUPER_ADMIN || loggedInUser.role === Role.ADMIN) ? (
                          <select
                            value={usr.teamId || "none"}
                            onChange={(e) => handleUpdateTeam(usr.id, e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 text-[11px] font-mono text-slate-700 font-semibold"
                          >
                            <option value="none">-- No Team --</option>
                            {teamsList.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-sm">
                            {teamsList.find(t => t.id === usr.teamId)?.name || "Unassigned"}
                          </span>
                        )}
                      </td>

                      {/* Approve accounts */}
                      <td className="p-4 pr-6 text-right space-x-2">
                        {usr.id !== loggedInUser?.id ? (
                          <>
                            {usr.status !== UserStatus.APPROVED && (
                              <Button
                                onClick={() => handleUpdateStatus(usr.id, UserStatus.APPROVED)}
                                variant="primary"
                                size="sm"
                                className="px-3 py-1 text-[11px] inline-flex items-center space-x-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </Button>
                            )}
                            {usr.status === UserStatus.APPROVED && (
                              <Button
                                onClick={() => handleUpdateStatus(usr.id, UserStatus.INACTIVE)}
                                variant="outline"
                                size="sm"
                                className="px-3 py-1 text-[11px] text-slate-600 border-slate-200 hover:bg-slate-50"
                              >
                                Deactivate
                              </Button>
                            )}
                            {usr.status === UserStatus.PENDING && (
                              <Button
                                onClick={() => handleUpdateStatus(usr.id, UserStatus.REJECTED)}
                                variant="danger"
                                size="sm"
                                className="px-3 py-1 text-[11px]"
                              >
                                Deny
                              </Button>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Current Session</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {usersList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 pr-6">
                        <div className="max-w-xs mx-auto space-y-2">
                          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-sm font-semibold">No registered members found</p>
                          <p className="text-xs text-slate-400 italic">Signups are requested directly from login portals.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {/* Creator panel bound on different plan variables */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-xl space-y-2">
                <span className="flex items-center text-xs font-bold text-amber-800 uppercase tracking-wider font-mono gap-1">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Invite Plan Simulator
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                  Select a subscription visual tier to adjust pre-assigned usage activation limits of your links.
                </p>
                <div className="pt-2">
                  <label className="block text-[9px] uppercase font-mono font-bold text-slate-500 mb-1">Target Account Level</label>
                  <select
                    value={invitePlan}
                    onChange={(e) => {
                      const sp = e.target.value as "Free" | "Paid" | "Enterprise";
                      setInvitePlan(sp);
                      if (sp === "Free") {
                        setInviteUsedLimit(1);
                      } else if (sp === "Paid") {
                        setInviteUsedLimit(5);
                      } else {
                        setInviteUsedLimit(0); // Unlimited
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="Free">🟢 Free Plan (Limit: 1-5 users)</option>
                    <option value="Paid">🔵 Paid Tier (Limit: 10-100 users)</option>
                    <option value="Enterprise">🏢 Enterprise Tier (Unlimited)</option>
                  </select>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateInvitation} className="md:col-span-2 space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center space-x-1.5 font-mono">
                <Link className="w-4 h-4 text-slate-700" />
                <span>Create Secure 7-Day Workspace Invite</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase font-mono font-bold text-slate-500 mb-1">Target Account Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                  >
                    {rolesOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-mono font-bold text-slate-500 mb-1">Squad / Team Pre-Alignment</label>
                  <select
                    value={inviteTeamId}
                    onChange={(e) => setInviteTeamId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                  >
                    <option value="">-- No predefined team --</option>
                    {teamsList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-mono font-bold text-slate-500 mb-1">Bound to Candidate Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. recruit@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-mono font-bold text-slate-500 mb-1">Usage / Activation limit</label>
                  <select
                    value={inviteUsedLimit}
                    onChange={(e) => setInviteUsedLimit(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value={1}>Single Recruit (Limit: 1 activation)</option>
                    <option value={5}>Cohort Squad (Limit: 5 activations)</option>
                    <option value={10}>Full Division (Limit: 10 activations)</option>
                    <option value={0}>Unlimited Signups</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" className="text-xs uppercase font-mono font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate 7-Day Referral Link
                </Button>
              </div>
            </form>
          </div>

          {/* List generated logs */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono font-sans">Workspace Referral Logs</span>
              <span className="text-[10px] text-slate-500 font-bold font-mono px-2 py-0.5 bg-slate-200 rounded-full">
                {invitationsList.length} Active Codes
              </span>
            </div>

            {isInvitationsLoading ? (
              <div className="py-12 text-center text-slate-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-800 mx-auto mb-2" />
                <span className="text-xs font-mono">syncing links...</span>
              </div>
            ) : invitationsList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600 font-sans">No invitation codes have been generated yet</p>
                <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-normal">
                  Generate referral tokens using the creator form above. Invites bypass pending approval requests and expire in 7 days automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs text-slate-700 font-sans">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="p-4 pl-6">Secure Code / Token</th>
                      <th className="p-4">Pre-assigned Target</th>
                      <th className="p-4">usage metric</th>
                      <th className="p-4">Plan simulate</th>
                      <th className="p-4">Deadline validity</th>
                      <th className="p-4 text-right pr-6 uppercase">Referral Link / actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invitationsList.map((inv) => {
                      const isExpired = new Date(inv.expiresAt) < new Date() || inv.status === "expired" || inv.status === "used_up";
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors text-xs">
                          <td className="p-4 pl-6 font-mono font-bold text-slate-700">
                            <span className="bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                              {inv.id}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="flex gap-1">
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-mono font-bold border border-slate-200">
                                  {inv.role}
                                </span>
                                {inv.teamName && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[9px] font-mono font-bold border border-blue-200">
                                    {inv.teamName}
                                  </span>
                                )}
                              </div>
                              {inv.email && (
                                <p className="text-[10px] text-slate-400 font-mono">Bound Recipient: {inv.email}</p>
                              )}
                              {inv.creatorName && (
                                <p className="text-[9px] text-slate-400 italic">Sent by Admin: {inv.creatorName}</p>
                              )}
                            </div>
                          </td>

                          <td className="p-4 font-mono font-semibold">
                            {inv.usedLimit === 0 ? (
                              <span className="text-slate-500 font-bold">
                                {inv.usedCount} / ∞ activations
                              </span>
                            ) : (
                              <span className={inv.usedCount >= inv.usedLimit ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                                {inv.usedCount} / {inv.usedLimit} activations
                              </span>
                            )}
                          </td>

                          <td className="p-4">
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded uppercase font-bold text-[9px]">
                              {inv.plan}
                            </span>
                          </td>

                          <td className="p-4 font-mono text-[10px]">
                            {isExpired ? (
                              <span className="inline-flex items-center space-x-1 text-rose-600 font-bold rounded-full bg-rose-50 px-2 py-0.5 border border-rose-200">
                                <Clock className="w-3 h-3" />
                                <span>Expired / Used Up</span>
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center space-x-1 text-emerald-600 font-bold rounded-full bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                                  <Clock className="w-3 h-3 animate-pulse" />
                                  <span>Active referral</span>
                                </span>
                                <p className="text-[9px] text-slate-400 font-mono">Till: {new Date(inv.expiresAt).toLocaleDateString([], {month:"short", day:"numeric", year:"numeric"})}</p>
                              </div>
                            )}
                          </td>

                          <td className="p-4 text-right pr-6">
                            {!isExpired && (
                              <div className="inline-flex space-x-2 items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(inv.id)}
                                  className="p-1 px-2 border border-slate-200 rounded-md hover:bg-slate-50 transition-all font-mono text-[10px] inline-flex items-center space-x-1 bg-white cursor-pointer"
                                  title="Copy Referral Signup Address"
                                >
                                  {copiedToken === inv.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600 animate-bounce" />
                                      <span className="text-emerald-700 font-bold">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-slate-500" />
                                      <span className="text-slate-600">Copy URL</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeInvitation(inv.id)}
                                  className="p-1 border border-rose-200 text-rose-500 hover:text-white hover:bg-rose-500 rounded-md transition-all font-semibold inline-flex items-center cursor-pointer"
                                  title="Revoke / Expire Token immediately"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            {isExpired && (
                              <span className="text-slate-400 italic font-mono text-[10px]">Inactive</span>
                            )}
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

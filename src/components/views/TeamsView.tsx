/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { Modal } from "../ui/Modal.js";
import { Team, User, Role } from "../../types/index.js";
import { Users, Plus, ShieldCheck, Trash2, ShieldAlert, UsersRound } from "lucide-react";

export function TeamsView() {
  const token = useUIStore((state) => state.token);
  const user = useUIStore((state) => state.user);
  
  const [teamsList, setTeamsList] = useState<Team[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [leadId, setLeadId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeams = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [tRes, uRes] = await Promise.all([
        fetch("/api/teams", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (tRes.ok) setTeamsList(await tRes.json());
      if (uRes.ok) setUsersList(await uRes.json());
    } catch (err) {
      console.warn("Error loading teams dataset:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [token]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !leadId) {
      setFormError("Team Name and Team Lead assignment are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: teamName, description: teamDesc, leadId })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create Team.");
      }

      setTeamName("");
      setTeamDesc("");
      setLeadId("");
      setIsModalOpen(false);
      fetchTeams();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeam = async (tId: string) => {
    if (!confirm("Confirm: Disband this team squad permanently? Assigned staff members will revert to unassigned positions.")) return;
    try {
      const res = await fetch(`/api/teams/${tId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTeams();
      } else {
        const d = await res.json();
        alert(`Error: ${d.error}`);
      }
    } catch {
      alert("Failed to delete team.");
    }
  };

  // Check privileges
  const canManage = user && (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || user.role === Role.PROJECT_MANAGER);

  const getLeadName = (leadId: string) => {
    const matched = usersList.find(u => u.id === leadId);
    return matched ? matched.name : "@" + leadId;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">System Squads & Teams</h2>
          <p className="text-slate-500 text-xs mt-1 font-mono uppercase tracking-wide">
            Enterprise division structures management
          </p>
        </div>
        {canManage && (
          <div className="mt-4 sm:mt-0">
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="primary"
              className="inline-flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Charter New Squad</span>
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-purple mx-auto mb-2" />
          <span className="text-xs text-slate-400 font-medium">Fetching corporate teams records...</span>
        </div>
      ) : (
        /* Team Grid Card lists */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamsList.map((team) => (
            <div
              key={team.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between h-56"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-purple-50 text-theme-purple rounded-lg">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800 font-display text-base leading-snug truncate">{team.name}</h3>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="p-1 px-2.5 text-slate-400 hover:text-theme-pink hover:bg-pink-50 rounded-lg transition-colors border border-slate-200/30"
                      title="Disband squad"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-sans line-clamp-2">
                  {team.description || "No charter details entered for this core squad group."}
                </p>
              </div>

              {/* Ranks details */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono font-medium">
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Designated Lead</div>
                  <div className="text-slate-800 font-bold">{getLeadName(team.leadId)}</div>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Active Staffs</div>
                  <div className="text-theme-teal font-extrabold">{team.membersCount} active</div>
                </div>
              </div>
            </div>
          ))}

          {teamsList.length === 0 && (
            <div className="col-span-full border-2 border-dashed border-slate-200 rounded-2xl py-24 text-center">
              <UsersRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">Company has no current active teams</p>
              <p className="text-xs text-slate-400 italic max-w-sm mx-auto mt-1 pl-4">
                Administrators can charter structures using the create action buttons above.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Team Charter Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Charter Core Squad">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-2.5 bg-pink-50 border border-pink-100 rounded-lg text-theme-pink text-xs font-semibold flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            id="t-name"
            label="Squad Name / Title"
            placeholder="e.g. Design Engineers"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />

          <div>
            <label htmlFor="t-desc" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
              Charter Description Statement
            </label>
            <textarea
              id="t-desc"
              rows={3}
              placeholder="State clear team goals..."
              value={teamDesc}
              onChange={(e) => setTeamDesc(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-theme-teal focus:ring-1 focus:ring-teal-400"
            />
          </div>

          <div>
            <label htmlFor="t-lead" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 px-1">
              Allot Corporate Team Lead
            </label>
            <select
              id="t-lead"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-theme-teal focus:ring-1"
            >
              <option value="">-- Choose Approved Lead --</option>
              {usersList.filter(u => u.status === "APPROVED").map((usr) => (
                <option key={usr.id} value={usr.id}>
                  {usr.name} (@{usr.username})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Apply Squad Charter
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

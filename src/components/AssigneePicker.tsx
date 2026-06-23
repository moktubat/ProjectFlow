/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Searchable assignee picker shared by the New Task panel (ProjectDetailsView)
 * and the Task Details sidebar. Supports individual users AND teams, and
 * pins previously-used assignees (from project.recentAssignees) to the top.
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Users as UsersIcon } from "lucide-react";
import { User } from "../types/index.js";

interface TeamLite { id: string; name: string; }

interface AssigneePickerProps {
    users: User[];
    teams: TeamLite[];
    selected: { userId?: string; teamId?: string }[];
    onChange: (next: { userId?: string; teamId?: string }[]) => void;
    recentIds?: string[]; // project.recentAssignees — most-recent-first
}

export function AssigneePicker({ users, teams, selected, onChange, recentIds = [] }: AssigneePickerProps) {
    const [query, setQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    const isSelectedUser = (id: string) => selected.some((s) => s.userId === id);
    const isSelectedTeam = (id: string) => selected.some((s) => s.teamId === id);

    const toggleUser = (id: string) =>
        onChange(isSelectedUser(id) ? selected.filter((s) => s.userId !== id) : [...selected, { userId: id }]);
    const toggleTeam = (id: string) =>
        onChange(isSelectedTeam(id) ? selected.filter((s) => s.teamId !== id) : [...selected, { teamId: id }]);

    // Build a combined, search-filtered, recency-sorted list of candidates.
    const { recentMatches, otherUserMatches, otherTeamMatches } = useMemo(() => {
        const q = query.trim().toLowerCase();

        const matchUser = (u: User) =>
            !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
        const matchTeam = (t: TeamLite) => !q || t.name.toLowerCase().includes(q);

        const recentSet = new Set(recentIds);
        const recentUserList = users.filter((u) => recentSet.has(u.id) && matchUser(u));
        const recentTeamList = teams.filter((t) => recentSet.has(t.id) && matchTeam(t));

        // Order "recent" by their position in recentIds (most-recent-first).
        const recentMatches: ({ kind: "user"; item: User } | { kind: "team"; item: TeamLite })[] = recentIds
            .map((id) => {
                const u = recentUserList.find((x) => x.id === id);
                if (u) return { kind: "user" as const, item: u };
                const t = recentTeamList.find((x) => x.id === id);
                if (t) return { kind: "team" as const, item: t };
                return null;
            })
            .filter(Boolean) as any;

        const otherUserMatches = users.filter((u) => !recentSet.has(u.id) && matchUser(u));
        const otherTeamMatches = teams.filter((t) => !recentSet.has(t.id) && matchTeam(t));

        return { recentMatches, otherUserMatches, otherTeamMatches };
    }, [users, teams, query, recentIds]);

    const hasAnyResults =
        recentMatches.length > 0 || otherUserMatches.length > 0 || otherTeamMatches.length > 0;

    return (
        <div ref={containerRef} className="space-y-2">
            {/* Search box */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A0A0]" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people or teams…"
                    className="w-full pl-8 pr-8 py-2 border border-[#D0D0D0] rounded-lg text-sm focus:outline-none focus:border-[#0038BC] focus:ring-2 focus:ring-[#0038BC]/10"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A0A0A0] hover:text-[#111111]"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selected.map((s, i) => {
                        const label = s.userId
                            ? users.find((u) => u.id === s.userId)?.name ?? "Unknown user"
                            : teams.find((t) => t.id === s.teamId)?.name ?? "Unknown team";
                        return (
                            <span
                                key={i}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${s.teamId ? "bg-[#fef3dc] text-[#9a5b00]" : "bg-[#e8edfb] text-[#0038BC]"
                                    }`}
                            >
                                {s.teamId && <UsersIcon className="w-3 h-3" />}
                                {label}
                                <button
                                    type="button"
                                    onClick={() => (s.userId ? toggleUser(s.userId) : toggleTeam(s.teamId!))}
                                    className="hover:opacity-70"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Results list */}
            <div className="max-h-44 overflow-y-auto border border-[#E8E8E8] rounded-lg bg-[#F7F8FA] p-1.5 space-y-1">
                {recentMatches.length > 0 && (
                    <>
                        <p className="text-[10px] uppercase tracking-wide text-[#A0A0A0] px-1.5 pt-1">Recently assigned</p>
                        {recentMatches.map((m) =>
                            m.kind === "user" ? (
                                <RowButton
                                    key={`recent-u-${m.item.id}`}
                                    label={m.item.name}
                                    sublabel={`@${m.item.username}`}
                                    selected={isSelectedUser(m.item.id)}
                                    onClick={() => toggleUser(m.item.id)}
                                />
                            ) : (
                                <RowButton
                                    key={`recent-t-${m.item.id}`}
                                    label={m.item.name}
                                    sublabel="Team"
                                    isTeam
                                    selected={isSelectedTeam(m.item.id)}
                                    onClick={() => toggleTeam(m.item.id)}
                                />
                            )
                        )}
                    </>
                )}

                {otherTeamMatches.length > 0 && (
                    <>
                        <p className="text-[10px] uppercase tracking-wide text-[#A0A0A0] px-1.5 pt-1.5">Teams</p>
                        {otherTeamMatches.map((t) => (
                            <RowButton
                                key={`t-${t.id}`}
                                label={t.name}
                                sublabel="Team"
                                isTeam
                                selected={isSelectedTeam(t.id)}
                                onClick={() => toggleTeam(t.id)}
                            />
                        ))}
                    </>
                )}

                {otherUserMatches.length > 0 && (
                    <>
                        <p className="text-[10px] uppercase tracking-wide text-[#A0A0A0] px-1.5 pt-1.5">People</p>
                        {otherUserMatches.map((u) => (
                            <RowButton
                                key={`u-${u.id}`}
                                label={u.name}
                                sublabel={`@${u.username}`}
                                selected={isSelectedUser(u.id)}
                                onClick={() => toggleUser(u.id)}
                            />
                        ))}
                    </>
                )}

                {!hasAnyResults && (
                    <p className="text-xs text-[#A0A0A0] text-center py-3">No matches.</p>
                )}
            </div>
        </div>
    );
}

function RowButton({
    label,
    sublabel,
    selected,
    isTeam = false,
    onClick,
}: {
    label: string;
    sublabel: string;
    selected: boolean;
    isTeam?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left border transition-colors ${selected
                    ? isTeam
                        ? "bg-[#fef3dc] border-[#EF8F00]/30 text-[#9a5b00]"
                        : "bg-[#e8edfb] border-[#0038BC]/20 text-[#0038BC]"
                    : "bg-white border-[#E8E8E8] text-[#525252] hover:bg-[#F4F4F4]"
                }`}
        >
            <div
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${selected ? (isTeam ? "bg-[#EF8F00] border-[#EF8F00]" : "bg-[#0038BC] border-[#0038BC]") : "border-[#D0D0D0]"
                    }`}
            >
                {selected && (
                    <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
            <span className="flex-1 truncate">{label}</span>
            <span className="text-xs text-[#A0A0A0] shrink-0">{sublabel}</span>
        </button>
    );
}
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Input } from "../ui/Input.js";
import { Button } from "../ui/Button.js";
import { UserCheck, Mail, Lock, ShieldAlert, ArrowLeft, CheckCircle } from "lucide-react";

export function RegisterView() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const navigate = useUIStore((state) => state.navigate);

  // Extract utility from hash parameters
  const getParamFromHash = (paramName: string): string | null => {
    const hash = window.location.hash;
    const match = hash.match(new RegExp(`[?&]${paramName}=([^&]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  };

  const inviteToken = getParamFromHash("inviteToken") || "";
  const isInvitationLegacy = window.location.hash.includes("invite=true");

  const [inviteData, setInviteData] = useState<any>(null);
  const [isInviteValidating, setIsInviteValidating] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Auto-lookup the token if passed in Hash Query
  React.useEffect(() => {
    if (inviteToken) {
      setIsInviteValidating(true);
      setInviteError(null);
      fetch(`/api/invitations/validate/${inviteToken}`)
        .then((res) => {
          if (!res.ok) throw new Error("Central lookup failed.");
          return res.json();
        })
        .then((data) => {
          if (data.error || data.valid === false) {
            setInviteError(data.error || `This invitation link is no longer valid. (Reason: ${data.reason || "Revoked or Expired"}).`);
          } else {
            setInviteData(data.invite);
            if (data.invite.email) {
              setEmail(data.invite.email);
            }
          }
        })
        .catch(() => {
          setInviteError("Failed to auto-verify invitation credentials with the server.");
        })
        .finally(() => {
          setIsInviteValidating(false);
        });
    }
  }, [inviteToken]);

  const inviteRole = getParamFromHash("role") || "";
  const inviteTeamId = getParamFromHash("teamId") || "";
  const isInvitation = !!inviteToken || isInvitationLegacy || !!inviteData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email || !password) {
      setError("Please fill out all fields.");
      return;
    }
    if (inviteToken && inviteError) {
      setError("You cannot register using an invalid or expired invitation link.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          username, 
          email, 
          password,
          isInvitation,
          role: inviteData ? inviteData.role : (inviteRole || undefined),
          teamId: inviteData ? inviteData.teamId : (inviteTeamId || undefined),
          inviteToken: inviteToken || undefined
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to register.");
      }

      if (isInvitation) {
        setSuccess(data.message || "Registration completed! Your account has been automatically activated and pre-configured.");
      } else {
        setSuccess(data.message || "Registration completed. Account pending approval.");
      }
    } catch (err: any) {
      setError(err.message || "Could not complete registration.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-cream flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-theme-blue/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-theme-green/25 blur-3xl" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-neo overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-brand-gradient p-6 text-slate-950 relative border-b-2 border-theme-black text-center">
          <button
            onClick={() => navigate("login")}
            className="absolute top-6 left-6 p-2 bg-theme-black hover:bg-slate-800 rounded-xl text-white transition-colors shadow-neo-sm"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="pt-4">
            <h2 className="text-xl font-black tracking-tight uppercase">
              {isInvitation ? "Accept Workspace Invite" : "Account Access Request"}
            </h2>
            <p className="text-slate-900 text-[10px] font-bold font-mono tracking-wider mt-1 uppercase">
              {isInvitation ? "🛡️ Auto-Approved Registration" : "For Administrator Review"}
            </p>
          </div>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-4 bg-theme-gray">
            <div className="w-16 h-16 bg-theme-green rounded-full flex items-center justify-center text-slate-950 mx-auto border-2 border-theme-black shadow-neo-sm">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {isInvitation ? "Registration Successful!" : "Request Submitted!"}
            </h3>
            <p className="text-slate-600 text-xs max-w-xs mx-auto leading-relaxed">
              {success}
            </p>
            <div className="pt-4">
              <Button onClick={() => navigate("login")} variant="secondary" className="px-8">
                Return to Login
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-theme-gray">
            {error && (
              <div className="p-3 bg-red-50 border-2 border-theme-black rounded-xl text-red-600 text-xs font-bold flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isInviteValidating && (
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-500 leading-normal font-bold font-mono animate-pulse text-center">
                🔄 Checking workspace invitation credentials...
              </div>
            )}

            {inviteError && (
              <div className="p-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-[11px] text-rose-700 leading-normal font-bold">
                ⚠️ Invalid Invite link: {inviteError}
              </div>
            )}

            {isInvitation && !inviteError && !isInviteValidating && (
              <div className="p-3 bg-emerald-50 border-2 border-theme-teal rounded-xl text-[11px] text-teal-800 leading-normal font-bold font-mono">
                ✨ Joining with invitation link! Your account will be automatically activated and pre-assigned to:
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-1.5 py-0.5 bg-theme-green text-emerald-800 rounded uppercase font-extrabold text-[9px] border border-emerald-300">
                    Role: {inviteData ? inviteData.role : (inviteRole || "JUNIOR")}
                  </span>
                  {(inviteData?.teamName || inviteTeamId) && (
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-900 rounded font-extrabold text-[9px] border border-blue-200">
                      Squad: {inviteData ? inviteData.teamName : "Assigned"}
                    </span>
                  )}
                  {inviteData?.creatorName && (
                    <span className="px-1.5 py-0.5 bg-purple-50 text-purple-900 rounded font-bold text-[9px] border border-purple-200">
                      By: {inviteData.creatorName}
                    </span>
                  )}
                </div>
              </div>
            )}

            <Input
              id="reg-full-name"
              label="Full Name"
              placeholder="e.g. Rachel Green"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              id="reg-username"
              label="Select Username"
              placeholder="e.g. rachelgreen"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <Input
              id="reg-email"
              label="Work Email Address"
              type="email"
              placeholder="e.g. rachel@projectflow.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              id="reg-pass"
              label="Secure Password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="secondary" className="w-full py-3 mt-2 text-xs uppercase tracking-wider" isLoading={isLoading}>
              {isInvitation ? "Activate & Join" : "Submit Request Approval"}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate("login")}
                className="text-xs text-slate-500 font-bold hover:text-slate-900 transition-colors"
              >
                Already have an active account? Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Input } from "../ui/Input.js";
import { Button } from "../ui/Button.js";
import { Briefcase, AlertCircle, CheckCircle2, ArrowLeft, Info } from "lucide-react";

export function RegisterView() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const navigate = useUIStore((s) => s.navigate);

  const getParamFromHash = (name: string) => {
    const hash = window.location.hash;
    const match = hash.match(new RegExp(`[?&]${name}=([^&]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  };

  const inviteToken = getParamFromHash("inviteToken") || "";
  const isInvitationLegacy = window.location.hash.includes("invite=true");
  const inviteRole = getParamFromHash("role") || "";
  const inviteTeamId = getParamFromHash("teamId") || "";

  const [inviteData, setInviteData] = useState<any>(null);
  const [isInviteValidating, setIsInviteValidating] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!inviteToken) return;
    setIsInviteValidating(true);
    fetch(`/api/invitations/validate/${inviteToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false || data.error) {
          setInviteError(data.error || `Invitation is no longer valid (${data.reason || "expired"}).`);
        } else {
          setInviteData(data.invite);
          if (data.invite.email) setEmail(data.invite.email);
        }
      })
      .catch(() => setInviteError("Failed to verify invitation."))
      .finally(() => setIsInviteValidating(false));
  }, [inviteToken]);

  const isInvitation = !!inviteToken || isInvitationLegacy || !!inviteData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email || !password) {
      setError("All fields are required.");
      return;
    }
    if (inviteToken && inviteError) {
      setError("Cannot register with an invalid invitation link.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, username, email, password,
          isInvitation,
          role: inviteData ? inviteData.role : (inviteRole || undefined),
          teamId: inviteData ? inviteData.teamId : (inviteTeamId || undefined),
          inviteToken: inviteToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");
      setSuccess(data.message || "Registration successful.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#0038BC]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#EF8F00]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Back link */}
        <button
          onClick={() => navigate("login")}
          className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#111111] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#0038BC] rounded-xl mb-3">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#111111]">
            {isInvitation ? "Accept invitation" : "Request access"}
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            {isInvitation ? "Your account will be activated automatically" : "An admin will review your request"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-6">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-[#111111]">
                  {isInvitation ? "Account activated!" : "Request submitted!"}
                </p>
                <p className="text-sm text-[#737373] mt-1">{success}</p>
              </div>
              <Button variant="primary" className="w-full justify-center" onClick={() => navigate("login")}>
                Go to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {isInviteValidating && (
                <div className="flex items-center gap-2 p-3 bg-[#F4F4F4] rounded-lg text-sm text-[#737373]">
                  <div className="w-3.5 h-3.5 border-2 border-[#0038BC] border-t-transparent rounded-full animate-spin shrink-0" />
                  Verifying invitation…
                </div>
              )}

              {inviteError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{inviteError}</span>
                </div>
              )}

              {isInvitation && !inviteError && !isInviteValidating && (
                <div className="flex items-start gap-2.5 p-3 bg-[#e8edfb] border border-[#0038BC]/20 rounded-lg text-sm text-[#0038BC]">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    Joining with invitation.
                    {inviteData && (
                      <span className="ml-1">
                        Role: <strong>{inviteData.role}</strong>
                        {inviteData.teamName && <>, Team: <strong>{inviteData.teamName}</strong></>}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <Input id="reg-name" label="Full name" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input id="reg-username" label="Username" placeholder="janesmith" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <Input id="reg-email" label="Work email" type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input id="reg-pass" label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />

              <Button type="submit" variant="primary" className="w-full justify-center py-2.5" isLoading={isLoading}>
                {isInvitation ? "Activate account" : "Submit request"}
              </Button>

              <p className="text-center text-sm text-[#737373]">
                Already have an account?{" "}
                <button type="button" onClick={() => navigate("login")} className="text-[#0038BC] font-medium hover:underline">
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
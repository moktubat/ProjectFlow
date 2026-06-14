import React, { useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Input } from "../ui/Input.js";
import { Button } from "../ui/Button.js";
import { Briefcase, AlertCircle, CheckCircle2 } from "lucide-react";

export function LoginView() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const setSession = useUIStore((s) => s.setSession);
  const navigate = useUIStore((s) => s.navigate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setError("Please enter your username/email and password.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      setSuccess("Signed in successfully. Redirecting…");
      setTimeout(() => {
        setSession(data.user, data.token);
        navigate("dashboard");
      }, 600);
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
      {/* Subtle background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#0038BC]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#EF8F00]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#0038BC] rounded-xl mb-4">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#111111]">ProjectFlow</h1>
          <p className="text-sm text-[#737373] mt-1">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2.5 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" role="status">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <Input
              id="login-id"
              label="Username or email"
              placeholder="Enter your username or email"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              autoComplete="username"
              required
            />
            <Input
              id="login-pass"
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-2.5 mt-2"
              isLoading={isLoading}
            >
              Sign in
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-[#737373]">Don't have an account? </span>
            <button
              type="button"
              onClick={() => navigate("register")}
              className="text-[#0038BC] font-medium hover:underline"
            >
              Request access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
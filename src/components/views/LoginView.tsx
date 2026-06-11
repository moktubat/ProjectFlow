/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useUIStore } from "../../store/ui-store.js";
import { Input } from "../ui/Input.js";
import { Button } from "../ui/Button.js";
import { Lock, User, Briefcase, Sparkles, CheckCircle2 } from "lucide-react";

export function LoginView() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const setSession = useUIStore((state) => state.setSession);
  const navigate = useUIStore((state) => state.navigate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setError("Please fill in all credentials.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      setSuccessMsg("Success! Accessing console...");
      // Delay slightly for smooth transitions
      setTimeout(() => {
        setSession(data.user, data.token);
        navigate("dashboard");
      }, 700);
    } catch (err: any) {
      setError(err.message || "Invalid username or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-cream flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background aesthetic blobs using requested brand gradient */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-theme-blue/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-theme-green/25 blur-3xl" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-neo overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-brand-gradient p-8 text-center relative border-b-2 border-theme-black">
          <div className="inline-flex p-3.5 bg-theme-black rounded-2xl text-theme-green shadow-sm mb-4">
            <Briefcase className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-100 uppercase">
            ProjectFlow
          </h2>
          <p className="text-slate-900 text-[10px] font-bold font-mono tracking-wider mt-1 uppercase">Enterprise PM Console</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-theme-gray">
          {error && (
            <div className="p-3.5 bg-red-50 border-2 border-theme-black rounded-xl text-red-600 text-xs font-bold flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-ping" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-theme-green border-2 border-theme-black rounded-xl text-slate-950 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="relative">
            <Input
              id="login-id"
              label="Username or Email address"
              placeholder="e.g. administrator"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              required
              className="pl-11"
            />
            <User className="w-4 h-4 text-slate-500 absolute left-4.5 top-10.5" />
          </div>

          <div className="relative">
            <Input
              id="login-pass"
              label="Account Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-11"
            />
            <Lock className="w-4 h-4 text-slate-500 absolute left-4.5 top-10.5" />
          </div>

          <Button type="submit" variant="secondary" className="w-full py-3.5 mt-2 text-xs uppercase tracking-wider h-12" isLoading={isLoading}>
            Sign In to Console
          </Button>

          <div className="text-center pt-2">
            <span className="text-xs text-slate-500 font-semibold">New member? </span>
            <button
              type="button"
              onClick={() => navigate("register")}
              className="text-xs text-theme-blue font-bold hover:underline"
            >
              Request Access Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

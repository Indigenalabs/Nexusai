import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fromUrl = useMemo(() => {
    const raw = searchParams.get("from_url");
    if (!raw) return "/";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [searchParams]);

  const onEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      window.location.href = fromUrl || "/";
    } catch (err) {
      setError(err?.message || "Login failed. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = () => {
    base44.auth.loginWithProvider("google", fromUrl || "/");
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[hsl(222,42%,8%)] p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
        <p className="text-sm text-slate-400 mb-6">Authenticate to access your Command Center.</p>

        <button
          type="button"
          onClick={onGoogleLogin}
          className="w-full mb-4 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm transition"
        >
          Continue with Google
        </button>

        <div className="relative my-4 text-center text-xs text-slate-500">
          <span className="px-2 bg-[hsl(222,42%,8%)] relative z-10">or email and password</span>
          <div className="absolute left-0 right-0 top-1/2 border-t border-white/10" />
        </div>

        <form onSubmit={onEmailLogin} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-4 py-2 text-sm font-medium transition"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-5">
          Need access? Contact your admin.
        </p>
        <Link to="/" className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300">
          Back to app
        </Link>
      </div>
    </div>
  );
}

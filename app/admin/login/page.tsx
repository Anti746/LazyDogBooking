"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Nesprávne heslo");
      return;
    }
    router.push("/admin/calendar");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-5">
      <div className="w-full max-w-sm rounded-card border border-line bg-paper p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-brown-dark">🐶 Lazy Dog</h1>
        <p className="mb-6 text-ink-soft">Prihlásenie do administrácie</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Heslo"
          className="input mb-3"
          autoFocus
        />
        {error && <p className="mb-3 text-sm font-semibold text-rust">{error}</p>}
        <button onClick={submit} disabled={loading} className="w-full rounded-xl bg-brown py-3 font-bold text-white hover:bg-brown-dark disabled:opacity-50">
          {loading ? "…" : "Prihlásiť sa"}
        </button>
      </div>
    </main>
  );
}

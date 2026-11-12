"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Échec de la connexion");
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#e7e7ee]"
      >
        <svg width="48" height="48" viewBox="0 0 64 64" className="mb-5" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#1b2340" />
          <path d="M18 24a16 16 0 0 1 14-10" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M16 36c4 0 4-8 8-8s4 14 8 14 4-18 8-18 4 12 8 12" fill="none" stroke="#a9b4ff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1 className="mb-1 font-display text-3xl font-extrabold tracking-tight text-[#1b2340]">Émail</h1>
        <p className="mb-6 text-sm text-slate-500">Dictée et devis dentaires. 
Entrez votre mot de passe pour continuer.
        </p>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4655d8]"
        />
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="w-full rounded-xl bg-[#4655d8] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3a48c4] disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}

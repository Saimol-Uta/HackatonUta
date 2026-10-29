"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setLoading(false);
    if (response?.ok) router.replace("/dashboard");
    else setError("Contraseña incorrecta o acceso deshabilitado.");
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Panel de operadores</h1>
          <p className="text-sm text-slate-500">CTT FISEI · Agente de ventas</p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Contraseña
          <input
            type="password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg py-2 font-medium"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}

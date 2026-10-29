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
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-navy-900 text-white p-12">
        <div className="size-9 rounded-md bg-white/10 grid place-items-center text-xs font-semibold">CTT</div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Agente de ventas</h2>
          <p className="mt-3 text-sm text-navy-100/70 max-w-sm">
            Conversaciones de Telegram en tiempo real, termómetro de interés y derivación a un asesor cuando hace falta.
          </p>
        </div>
        <p className="text-[11px] text-navy-100/50">CTT FISEI · Universidad Técnica de Ambato</p>
      </section>

      <section className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold text-navy-900">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-slate-500">Panel de operadores</p>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
            Contraseña
            <input
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="normal-case tracking-normal text-base text-slate-900 bg-white border border-slate-200 focus:border-navy-700 outline-none rounded-md px-3.5 py-2.5 transition-colors"
            />
          </label>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <button
            disabled={loading}
            className="bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-md py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

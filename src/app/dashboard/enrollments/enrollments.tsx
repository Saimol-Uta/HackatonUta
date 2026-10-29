"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EnrollmentRow } from "@/adapters/supabase/dashboard-queries";
import type { EnrollmentStatus } from "@/core/conversation/types";
import { PageHeader, Shimmer, TIME_ZONE, usePolled } from "../shared";

const STATUS: Record<EnrollmentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmada", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelada", className: "bg-slate-100 text-slate-500" },
};

type Filter = "all" | EnrollmentStatus;

const date = (iso: string) =>
  new Date(iso).toLocaleString("es-EC", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function Enrollments() {
  const [rows, reload] = usePolled<EnrollmentRow[]>("/api/operator/enrollments");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, pending: 0, confirmed: 0, cancelled: 0 };
    for (const row of rows ?? []) {
      c.all += 1;
      c[row.status] += 1;
    }
    return c;
  }, [rows]);
  const visible = (rows ?? []).filter((r) => filter === "all" || r.status === filter);

  async function setStatus(id: number, status: EnrollmentStatus) {
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/operator/enrollments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    setBusyId(null);
    if (!response?.ok) setError("No se pudo actualizar la inscripción. Intenta de nuevo.");
    await reload();
  }

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "Todas" },
    { id: "pending", label: "Pendientes" },
    { id: "confirmed", label: "Confirmadas" },
    { id: "cancelled", label: "Canceladas" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title="Inscripciones" subtitle="Solicitudes que el bot registró con nombre, correo y teléfono. Confirma el pago y el cupo." />

      <div className="px-6 pb-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["pending", "confirmed", "cancelled"] as const).map((status, index) => (
            <div
              key={status}
              style={{ animationDelay: `${index * 40}ms` }}
              className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200/70 p-5"
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{STATUS[status].label}s</div>
              {rows ? (
                <div className="mt-1 text-3xl font-semibold tabular-nums text-navy-900">{counts[status]}</div>
              ) : (
                <Shimmer className="mt-2 h-8 w-12" />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Solicitudes</h2>
            <div className="flex gap-1 p-1 rounded-lg bg-slate-100">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    filter === tab.id ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1 text-[10px] text-slate-400">{counts[tab.id]}</span>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="px-5 py-2 text-xs text-rose-700 bg-rose-50">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-5 py-2.5 font-medium">Prospecto</th>
                  <th className="px-5 py-2.5 font-medium">Curso</th>
                  <th className="px-5 py-2.5 font-medium hidden md:table-cell">Contacto</th>
                  <th className="px-5 py-2.5 font-medium hidden lg:table-cell">Fecha</th>
                  <th className="px-5 py-2.5 font-medium">Estado</th>
                  <th className="px-5 py-2.5 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!rows &&
                  [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-5 py-3">
                        <Shimmer className="h-4 w-full" />
                      </td>
                    </tr>
                  ))}
                {rows && visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                      {rows.length === 0
                        ? "Aún no hay inscripciones. Aparecen cuando un prospecto da su nombre, correo y teléfono."
                        : "No hay inscripciones en este estado."}
                    </td>
                  </tr>
                )}
                {visible.map((row) => (
                  <tr key={row.id} className="animate-fade-up hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{row.fullName}</div>
                      <Link href={`/dashboard/chats?c=${row.conversationId}`} className="text-xs text-navy-700 hover:underline">
                        Ver conversación
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.courseName}</td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <div className="text-slate-700">{row.email ?? "—"}</div>
                      <div className="text-xs text-slate-400 tabular-nums">{row.phone ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden lg:table-cell whitespace-nowrap">{date(row.createdAt)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[row.status].className}`}>
                        {STATUS[row.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {row.status !== "confirmed" && (
                        <button
                          disabled={busyId === row.id}
                          onClick={() => setStatus(row.id, "confirmed")}
                          className="text-xs font-medium bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-md px-3 py-1.5 transition-colors"
                        >
                          Confirmar
                        </button>
                      )}
                      {row.status !== "cancelled" && (
                        <button
                          disabled={busyId === row.id}
                          onClick={() => setStatus(row.id, "cancelled")}
                          className="ml-2 text-xs font-medium text-slate-500 hover:text-rose-700 disabled:opacity-50 rounded-md px-2 py-1.5 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

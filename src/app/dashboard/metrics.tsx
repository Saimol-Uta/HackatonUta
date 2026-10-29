"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardStats } from "@/adapters/supabase/dashboard-queries";
import type { CourseLifecycle } from "@/core/catalog/course-lifecycle";
import type { IntentState } from "@/core/conversation/types";
import type { CourseInsight } from "@/server/course-insights";
import { AlertIcon, BookIcon, ChatIcon, FlameIcon, ShieldIcon, SwapIcon, UserIcon } from "./icons";
import { INTENT, PageHeader, Shimmer, usePolled } from "./shared";

const LIFECYCLE: Record<CourseLifecycle, { label: string; className: string; sellable: boolean }> = {
  enrollment_open: { label: "Inscripciones abiertas", className: "bg-emerald-50 text-emerald-700", sellable: true },
  upcoming: { label: "Próximo", className: "bg-sky-50 text-sky-700", sellable: true },
  enrollment_closed: { label: "Inscripciones cerradas", className: "bg-amber-50 text-amber-700", sellable: false },
  in_progress: { label: "En curso", className: "bg-navy-50 text-navy-800", sellable: false },
  finished: { label: "Finalizado", className: "bg-slate-100 text-slate-500", sellable: false },
  unknown: { label: "Por confirmar", className: "bg-slate-100 text-slate-500", sellable: false },
};

type CourseFilter = "all" | "sellable" | "demand";

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`rounded-2xl bg-white ring-1 ring-slate-200/70 ${className}`}>
      {children}
    </div>
  );
}

function Kpi({ label, value, hint, icon, tone = "navy", index }: { label: string; value?: number | string; hint?: string; icon: React.ReactNode; tone?: "navy" | "alert"; index: number }) {
  return (
    <Card style={{ animationDelay: `${index * 40}ms` }} className="animate-fade-up p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
          {value === undefined ? (
            <Shimmer className="mt-2 h-8 w-14" />
          ) : (
            <div className={`mt-1 text-3xl font-semibold tabular-nums ${tone === "alert" ? "text-rose-600" : "text-navy-900"}`}>{value}</div>
          )}
          {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
        </div>
        <div className={`size-10 rounded-xl grid place-items-center ${tone === "alert" ? "bg-rose-50 text-rose-500" : "bg-navy-50 text-navy-700"}`}>{icon}</div>
      </div>
    </Card>
  );
}

function IntentDistribution({ stats }: { stats: DashboardStats | null }) {
  const order: IntentState[] = ["interested", "doubtful", "hot_lead", "frustrated"];
  const total = stats ? order.reduce((sum, s) => sum + stats.byIntent[s], 0) : 0;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">Termómetro de interés</h2>
      <p className="text-xs text-slate-400">Estado actual de todas las conversaciones</p>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {stats &&
          total > 0 &&
          order.map((state) => (
            <div
              key={state}
              title={`${INTENT[state].label}: ${stats.byIntent[state]}`}
              className={`${INTENT[state].bar} transition-all duration-700`}
              style={{ width: `${(stats.byIntent[state] / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="mt-5 space-y-3">
        {order.map((state) => {
          const value = stats?.byIntent[state] ?? 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
          return (
            <li key={state} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className={`size-2 rounded-full ${INTENT[state].dot}`} />
                {INTENT[state].label}
              </span>
              <span className="tabular-nums text-slate-900 font-medium">
                {value} <span className="text-xs text-slate-400 font-normal">· {pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TopCourses({ courses }: { courses: CourseInsight[] | null }) {
  const top = (courses ?? []).filter((c) => c.conversations > 0).sort((a, b) => b.conversations - a.conversations).slice(0, 5);
  const max = top[0]?.conversations ?? 1;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">Cursos más consultados</h2>
      <p className="text-xs text-slate-400">Conversaciones por curso de interés</p>
      {top.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">Todavía no hay consultas asociadas a un curso.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {top.map((course) => (
            <li key={course.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-slate-700">{course.name}</span>
                <span className="shrink-0 tabular-nums font-medium text-navy-900">{course.conversations}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-navy-800 transition-all duration-700" style={{ width: `${(course.conversations / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CourseTable({ courses }: { courses: CourseInsight[] | null }) {
  const [filter, setFilter] = useState<CourseFilter>("all");
  const rows = useMemo(() => {
    const list = courses ?? [];
    if (filter === "sellable") return list.filter((c) => LIFECYCLE[c.lifecycle].sellable);
    if (filter === "demand") return [...list].filter((c) => c.conversations > 0).sort((a, b) => b.conversations - a.conversations);
    return list;
  }, [courses, filter]);

  const tabs: { id: CourseFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "sellable", label: "A la venta" },
    { id: "demand", label: "Con demanda" },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Catálogo de cursos</h2>
          <p className="text-xs text-slate-400">Estado calculado con las fechas de inscripción y de clases</p>
        </div>
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
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
              <th className="px-5 py-2.5 font-medium">Curso</th>
              <th className="px-5 py-2.5 font-medium">Estado</th>
              <th className="px-5 py-2.5 font-medium hidden lg:table-cell">Modalidad</th>
              <th className="px-5 py-2.5 font-medium hidden md:table-cell">Clases</th>
              <th className="px-5 py-2.5 font-medium text-right hidden sm:table-cell">Precio público</th>
              <th className="px-5 py-2.5 font-medium text-right">Consultas</th>
              <th className="px-5 py-2.5 font-medium text-right">Leads</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!courses &&
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-5 py-3">
                    <Shimmer className="h-4 w-full" />
                  </td>
                </tr>
              ))}
            {courses && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">
                  No hay cursos en esta vista.
                </td>
              </tr>
            )}
            {rows.map((course) => (
              <tr key={course.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-3">
                  <a href={course.url} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-navy-700">
                    {course.name}
                  </a>
                  <div className="text-xs text-slate-400">
                    {course.slug}
                    {course.trainingHours ? ` · ${course.trainingHours} h` : ""}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${LIFECYCLE[course.lifecycle].className}`}>
                    {LIFECYCLE[course.lifecycle].label}
                  </span>
                  <div className="mt-0.5 text-[11px] text-slate-400">{course.stateLabel}</div>
                </td>
                <td className="px-5 py-3 text-slate-600 hidden lg:table-cell">{course.modality ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600 tabular-nums hidden md:table-cell whitespace-nowrap">
                  {course.startDate ? `${course.startDate} → ${course.endDate ?? "?"}` : "—"}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-700 hidden sm:table-cell">
                  {course.publicPrice !== null ? `$${course.publicPrice}` : "—"}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-navy-900">{course.conversations}</td>
                <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{course.hotLeads || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Metrics() {
  const [stats] = usePolled<DashboardStats>("/api/operator/stats");
  const [courses] = usePolled<CourseInsight[]>("/api/operator/courses");

  const sellable = courses?.filter((c) => LIFECYCLE[c.lifecycle].sellable).length;
  const conversion = stats && stats.conversations > 0 ? `${Math.round((stats.byIntent.hot_lead / stats.conversations) * 100)}%` : undefined;

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title="Métricas" subtitle="Rendimiento del agente de ventas y estado del catálogo.">
        <Link
          href="/dashboard/chats"
          className="inline-flex items-center gap-2 text-sm font-medium bg-navy-900 hover:bg-navy-800 text-white rounded-lg px-4 py-2 shadow-sm transition-colors"
        >
          <ChatIcon className="size-4" /> Ver conversaciones
        </Link>
      </PageHeader>

      <div className="px-6 pb-8 space-y-6">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Conversaciones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi index={0} label="Conversaciones" value={stats?.conversations} icon={<ChatIcon className="size-5" />} />
            <Kpi index={1} label="Leads calientes" value={stats?.byIntent.hot_lead} hint={conversion ? `${conversion} del total` : undefined} icon={<FlameIcon className="size-5" />} />
            <Kpi
              index={2}
              label="Requieren atención"
              value={stats?.needsAttention}
              tone={stats?.needsAttention ? "alert" : "navy"}
              icon={<AlertIcon className="size-5" />}
            />
            <Kpi index={3} label="Con operador" value={stats?.inHumanMode} hint="IA en pausa" icon={<UserIcon className="size-5" />} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Operación y catálogo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi index={4} label="Cursos en catálogo" value={courses?.length} icon={<BookIcon className="size-5" />} />
            <Kpi index={5} label="Cursos a la venta" value={sellable} hint="Próximos o con inscripción abierta" icon={<BookIcon className="size-5" />} />
            <Kpi index={6} label="Derivaciones a humano" value={stats?.events.handover} icon={<SwapIcon className="size-5" />} />
            <Kpi index={7} label="Manipulación bloqueada" value={stats?.events.injection_attempt} icon={<ShieldIcon className="size-5" />} />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <IntentDistribution stats={stats} />
          <TopCourses courses={courses} />
        </section>

        <CourseTable courses={courses} />
      </div>
    </div>
  );
}

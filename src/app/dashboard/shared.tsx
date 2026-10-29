"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { IntentState } from "@/core/conversation/types";

export const POLL_MS = 3000;
export const TIME_ZONE = "America/Guayaquil";

// Muted tones: a small dot carries the color, the label stays neutral.
export const INTENT: Record<IntentState, { label: string; dot: string; bar: string }> = {
  interested: { label: "Interesado", dot: "bg-sky-500", bar: "bg-sky-500" },
  doubtful: { label: "Dudoso", dot: "bg-amber-500", bar: "bg-amber-500" },
  frustrated: { label: "Frustrado", dot: "bg-rose-500", bar: "bg-rose-500" },
  hot_lead: { label: "Lead caliente", dot: "bg-emerald-500", bar: "bg-emerald-500" },
};

export async function getJson<T>(url: string): Promise<T | "unauthorized" | null> {
  const response = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (response?.status === 401) return "unauthorized";
  return response?.ok ? ((await response.json()) as T) : null;
}

/** Polls an operator API; sends the operator to /login when the session ends. */
export function usePolled<T>(url: string | null): [T | null, () => Promise<void>] {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(async () => {
    if (!url) return;
    const result = await getJson<T>(url);
    if (result === "unauthorized") router.replace("/login");
    else if (result) setData(result);
  }, [router, url]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return [data, load];
}

export function IntentBadge({ state }: { state: IntentState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 rounded-full px-2 py-0.5 bg-slate-100">
      <span className={`size-1.5 rounded-full ${INTENT[state].dot}`} />
      {INTENT[state].label}
    </span>
  );
}

export function Shimmer({ className }: { className: string }) {
  return <div className={`rounded bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer ${className}`} />;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-6 pt-6 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

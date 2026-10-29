"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationCard, ConversationDetail, DashboardStats } from "@/adapters/supabase/dashboard-queries";
import type { IntentState, MessageRole } from "@/core/conversation/types";

const POLL_MS = 3000;

// Muted tones: a small dot carries the color, the label stays neutral.
const INTENT: Record<IntentState, { label: string; dot: string }> = {
  interested: { label: "Interesado", dot: "bg-sky-600" },
  doubtful: { label: "Dudoso", dot: "bg-amber-500" },
  frustrated: { label: "Frustrado", dot: "bg-rose-600" },
  hot_lead: { label: "Lead caliente", dot: "bg-emerald-600" },
};

const ROLE: Record<MessageRole, { label: string; bubble: string; align: string; meta: string }> = {
  user: { label: "Prospecto", bubble: "bg-white border border-slate-200 text-slate-800", align: "self-start", meta: "text-slate-400" },
  ai: { label: "Asistente IA", bubble: "bg-navy-900 text-white", align: "self-end", meta: "text-navy-100/70" },
  operator: { label: "Operador", bubble: "bg-navy-100 text-navy-950", align: "self-end", meta: "text-navy-700/70" },
  system: { label: "Sistema", bubble: "bg-transparent text-slate-400 italic", align: "self-center", meta: "text-slate-400" },
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

async function getJson<T>(url: string): Promise<T | "unauthorized" | null> {
  const response = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (response?.status === 401) return "unauthorized";
  return response?.ok ? ((await response.json()) as T) : null;
}

function IntentBadge({ state }: { state: IntentState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 border border-slate-200 rounded-full px-2 py-0.5 bg-white">
      <span className={`size-1.5 rounded-full ${INTENT[state].dot}`} />
      {INTENT[state].label}
    </span>
  );
}

function StatsBar({ stats }: { stats: DashboardStats | null }) {
  const tiles: [string, number | undefined, boolean?][] = [
    ["Conversaciones", stats?.conversations],
    ["Leads calientes", stats?.byIntent.hot_lead],
    ["Requieren atención", stats?.needsAttention, true],
    ["Atendidas por humano", stats?.inHumanMode],
    ["Derivaciones", stats?.events.handover],
    ["Intentos de manipulación", stats?.events.injection_attempt],
  ];
  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 divide-x divide-slate-200 border-b border-slate-200 bg-white">
      {tiles.map(([label, value, alert]) => (
        <div key={label} className="px-5 py-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
          <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${alert && value ? "text-rose-700" : "text-navy-900"}`}>
            {value ?? "–"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const router = useRouter();
  const [cards, setCards] = useState<ConversationCard[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [list, summary, chat] = await Promise.all([
      getJson<ConversationCard[]>("/api/operator/conversations"),
      getJson<DashboardStats>("/api/operator/stats"),
      selectedId ? getJson<ConversationDetail>(`/api/operator/conversations/${selectedId}`) : Promise.resolve(null),
    ]);
    if (list === "unauthorized" || summary === "unauthorized" || chat === "unauthorized") {
      router.replace("/login");
      return;
    }
    if (list) setCards(list);
    if (summary) setStats(summary);
    if (chat) setDetail(chat);
  }, [router, selectedId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const messageCount = detail?.messages.length ?? 0;
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messageCount, selectedId]);

  async function act(path: string, body?: object) {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/operator/conversations/${selectedId}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string; detail?: string } | null;
      setNotice(
        body?.error === "not_found"
          ? "La conversación ya no existe."
          : `No se pudo completar la acción${body?.detail ? `: ${body.detail}` : ". Intenta de nuevo."}`,
      );
    }
    await refresh();
    return response?.ok ?? false;
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (await act("messages", { text: draft })) setDraft("");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const selected = detail && detail.id === selectedId ? detail : null;

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 h-14 bg-navy-900 text-white">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-md bg-white/10 grid place-items-center text-xs font-semibold">CTT</div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-wide">Panel de operadores</h1>
            <p className="text-[11px] text-navy-100/70">CTT FISEI · Universidad Técnica de Ambato</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-navy-100/70">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            En vivo
          </span>
          <button
            onClick={logout}
            className="text-xs text-navy-100 hover:text-white border border-white/20 hover:border-white/40 rounded-md px-3 py-1.5 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <StatsBar stats={stats} />

      <div className="flex-1 flex min-h-0">
        <aside className="w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-5 py-3 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
            Conversaciones
          </div>
          <div className="flex-1 overflow-y-auto">
            {cards.length === 0 && <p className="p-5 text-sm text-slate-400">Aún no hay conversaciones.</p>}
            {cards.map((card) => {
              const active = card.id === selectedId;
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    setSelectedId(card.id);
                    setNotice(null);
                  }}
                  className={`w-full text-left px-5 py-3.5 border-b border-slate-100 border-l-2 transition-colors ${
                    active ? "bg-navy-50 border-l-navy-900" : "border-l-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 shrink-0 rounded-full bg-navy-100 text-navy-900 grid place-items-center text-xs font-semibold">
                      {initials(card.contactName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{card.contactName}</span>
                        {card.needsAttention && <span className="size-2 rounded-full bg-rose-600 shrink-0" title="Requiere atención" />}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{card.courseName ?? "Sin curso identificado"}</div>
                    </div>
                  </div>
                  <div className="mt-2 pl-12 flex items-center justify-between">
                    <IntentBadge state={card.intentState} />
                    <span className="text-[11px] text-slate-400">
                      {card.mode === "human" ? "Operador" : "IA"} · {time(card.lastMessageAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 grid place-items-center text-center">
              <div>
                <div className="mx-auto size-12 rounded-full bg-navy-100 mb-3" />
                <p className="text-sm text-slate-500">
                  {selectedId ? "Cargando conversación…" : "Selecciona una conversación para ver el chat."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-white border-b border-slate-200">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900 truncate">{selected.contactName}</h2>
                    {selected.username && <span className="text-xs text-slate-400">@{selected.username}</span>}
                    <IntentBadge state={selected.intentState} />
                    {selected.needsAttention && (
                      <span className="text-[11px] font-medium text-rose-700 border border-rose-200 bg-rose-50 rounded-full px-2 py-0.5">
                        Requiere atención
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selected.courseName ?? "Sin curso identificado"} ·{" "}
                    {selected.mode === "human" ? "Atendida por un operador · IA en pausa" : "Atendida por la IA"}
                  </p>
                </div>
                {selected.mode === "ai" ? (
                  <button
                    disabled={busy}
                    onClick={() => act("take-over")}
                    className="text-sm font-medium bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-md px-4 py-2 transition-colors"
                  >
                    Tomar el control
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => act("resume")}
                    className="text-sm font-medium border border-navy-900 text-navy-900 hover:bg-navy-50 disabled:opacity-50 rounded-md px-4 py-2 transition-colors"
                  >
                    Devolver a la IA
                  </button>
                )}
              </div>

              {selected.summary && (
                <div className="px-6 py-2.5 bg-navy-50 border-b border-slate-200 text-xs text-slate-600">
                  <span className="font-semibold text-navy-900">Resumen · </span>
                  {selected.summary}
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
                {selected.messages.map((message) => {
                  const role = ROLE[message.role];
                  return (
                    <div key={message.id} className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${role.bubble} ${role.align}`}>
                      <div className={`text-[10px] uppercase tracking-wider mb-1 ${role.meta}`}>
                        {role.label} · {time(message.createdAt)}
                      </div>
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="bg-white border-t border-slate-200 px-6 py-3">
                <form onSubmit={send} className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={4000}
                    placeholder="Escribe una respuesta. Al enviar, la IA queda en pausa."
                    className="flex-1 bg-slate-50 border border-slate-200 focus:border-navy-700 focus:bg-white outline-none rounded-md px-3.5 py-2 text-sm transition-colors"
                  />
                  <button
                    disabled={busy || !draft.trim()}
                    className="text-sm font-medium bg-navy-900 hover:bg-navy-800 disabled:opacity-40 text-white rounded-md px-5 transition-colors"
                  >
                    Enviar
                  </button>
                </form>
                {notice && <p className="mt-2 text-xs text-rose-700">{notice}</p>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

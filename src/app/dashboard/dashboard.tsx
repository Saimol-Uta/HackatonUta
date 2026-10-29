"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationCard, ConversationDetail, DashboardStats } from "@/adapters/supabase/dashboard-queries";
import type { IntentState, MessageRole } from "@/core/conversation/types";

const POLL_MS = 3000;

const INTENT: Record<IntentState, { label: string; className: string }> = {
  interested: { label: "Interesado", className: "bg-sky-100 text-sky-800" },
  doubtful: { label: "Dudoso", className: "bg-amber-100 text-amber-800" },
  frustrated: { label: "Frustrado", className: "bg-red-100 text-red-800" },
  hot_lead: { label: "Lead caliente", className: "bg-emerald-100 text-emerald-800" },
};

const ROLE: Record<MessageRole, { label: string; className: string; align: string }> = {
  user: { label: "Prospecto", className: "bg-white border border-slate-200", align: "self-start" },
  ai: { label: "IA", className: "bg-indigo-50 border border-indigo-100", align: "self-end" },
  operator: { label: "Operador", className: "bg-emerald-50 border border-emerald-200", align: "self-end" },
  system: { label: "Sistema", className: "bg-slate-100 text-slate-500", align: "self-center" },
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" });

async function getJson<T>(url: string): Promise<T | "unauthorized" | null> {
  const response = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (response?.status === 401) return "unauthorized";
  return response?.ok ? ((await response.json()) as T) : null;
}

function IntentBadge({ state }: { state: IntentState }) {
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${INTENT[state].className}`}>{INTENT[state].label}</span>;
}

function StatsBar({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return null;
  const tiles = [
    ["Conversaciones", stats.conversations],
    ["Leads calientes", stats.byIntent.hot_lead],
    ["Requieren atención", stats.needsAttention],
    ["Atendidas por humano", stats.inHumanMode],
    ["Derivaciones", stats.events.handover],
    ["Intentos de manipulación", stats.events.injection_attempt],
  ] as const;
  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 p-3 border-b border-slate-200 bg-white">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-xl font-semibold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
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
    if (!response?.ok) setNotice("No se pudo completar la acción. Intenta de nuevo.");
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
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900">
      <header className="flex items-center justify-between px-4 py-3 bg-indigo-700 text-white">
        <div>
          <h1 className="font-semibold">Panel de operadores · CTT FISEI</h1>
          <p className="text-xs text-indigo-100">Se actualiza automáticamente cada 3 segundos</p>
        </div>
        <button onClick={logout} className="text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1.5">
          Cerrar sesión
        </button>
      </header>
      <StatsBar stats={stats} />

      <div className="flex-1 flex min-h-0">
        <aside className="w-80 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          {cards.length === 0 && <p className="p-4 text-sm text-slate-500">Aún no hay conversaciones.</p>}
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => {
                setSelectedId(card.id);
                setNotice(null);
              }}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                card.id === selectedId ? "bg-indigo-50" : ""
              } ${card.needsAttention ? "border-l-4 border-l-red-500" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{card.contactName}</span>
                <IntentBadge state={card.intentState} />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">{card.courseName ?? "Sin curso identificado"}</span>
                <span>{card.mode === "human" ? "👤 Humano" : "🤖 IA"}</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{time(card.lastMessageAt)}</div>
            </button>
          ))}
        </aside>

        <section className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 grid place-items-center text-slate-500 text-sm">
              {selectedId ? "Cargando conversación…" : "Selecciona una conversación para ver el chat."}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-white border-b border-slate-200">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold truncate">{selected.contactName}</h2>
                    {selected.username && <span className="text-xs text-slate-500">@{selected.username}</span>}
                    <IntentBadge state={selected.intentState} />
                    {selected.needsAttention && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-600 text-white">Requiere atención</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {selected.courseName ?? "Sin curso identificado"} ·{" "}
                    {selected.mode === "human" ? "Atendida por un operador (la IA está en pausa)" : "Atendida por la IA"}
                  </p>
                </div>
                {selected.mode === "ai" ? (
                  <button
                    disabled={busy}
                    onClick={() => act("take-over")}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm rounded-lg px-3 py-1.5"
                  >
                    Tomar el control
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => act("resume")}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm rounded-lg px-3 py-1.5"
                  >
                    Devolver a la IA
                  </button>
                )}
              </div>

              {selected.summary && (
                <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-slate-700">
                  <span className="font-semibold">Resumen: </span>
                  {selected.summary}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {selected.messages.map((message) => (
                  <div key={message.id} className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${ROLE[message.role].className} ${ROLE[message.role].align}`}>
                    <div className="text-[11px] text-slate-500 mb-0.5">
                      {ROLE[message.role].label} · {time(message.createdAt)}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="flex gap-2 p-3 bg-white border-t border-slate-200">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={4000}
                  placeholder="Escribe una respuesta (al enviar, la IA queda en pausa)…"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={busy || !draft.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm rounded-lg px-4"
                >
                  Enviar
                </button>
              </form>
              {notice && <p className="px-4 pb-2 text-sm text-red-600 bg-white">{notice}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

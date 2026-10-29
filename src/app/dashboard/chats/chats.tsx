"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConversationCard, ConversationDetail } from "@/adapters/supabase/dashboard-queries";
import type { Message, MessageRole } from "@/core/conversation/types";
import { AlertIcon, BackIcon, BotIcon, ChatIcon, SearchIcon, SendIcon, UserIcon } from "../icons";
import { IntentBadge, POLL_MS, Shimmer, TIME_ZONE, getJson } from "../shared";

const ROLE: Record<MessageRole, { label: string; bubble: string; align: string; meta: string }> = {
  user: { label: "Prospecto", bubble: "bg-white ring-1 ring-slate-200 text-slate-800 rounded-bl-md", align: "self-start", meta: "text-slate-400" },
  ai: { label: "Asistente IA", bubble: "bg-navy-900 text-white rounded-br-md", align: "self-end", meta: "text-navy-200/80" },
  operator: { label: "Operador", bubble: "bg-navy-100 text-navy-950 rounded-br-md", align: "self-end", meta: "text-navy-700/70" },
  system: { label: "Sistema", bubble: "bg-transparent text-slate-400 italic", align: "self-center", meta: "text-slate-400" },
};

type Filter = "all" | "attention" | "hot" | "human";
const FILTERS: { id: Filter; label: string; match: (c: ConversationCard) => boolean }[] = [
  { id: "all", label: "Todas", match: () => true },
  { id: "attention", label: "Atención", match: (c) => c.needsAttention },
  { id: "hot", label: "Leads", match: (c) => c.intentState === "hot_lead" },
  { id: "human", label: "Humano", match: (c) => c.mode === "human" },
];

const clock = (iso: string) => new Date(iso).toLocaleTimeString("es-EC", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("es-EC", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

function relative(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return new Date(iso).toLocaleDateString("es-EC", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

function Avatar({ name, size = "size-9" }: { name: string; size?: string }) {
  return (
    <div className={`${size} shrink-0 rounded-full bg-gradient-to-br from-navy-100 to-navy-200 text-navy-900 grid place-items-center text-xs font-semibold`}>
      {initials(name)}
    </div>
  );
}

function ConversationList({
  cards,
  loaded,
  selectedId,
  onSelect,
  now,
}: {
  cards: ConversationCard[];
  loaded: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  now: number;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = FILTERS.find((f) => f.id === filter)!.match;
    return cards.filter(
      (c) => match(c) && (!q || [c.contactName, c.username, c.courseName].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [cards, query, filter]);

  return (
    <>
      <div className="p-4 space-y-3 border-b border-slate-100">
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 focus-within:ring-navy-700 focus-within:bg-white px-3 py-2 transition-all">
          <SearchIcon className="size-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar contacto o curso"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </label>
        <div className="flex gap-1 p-1 rounded-lg bg-slate-100">
          {FILTERS.map((f) => {
            const count = cards.filter(f.match).length;
            const active = f.id === filter;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
                  active ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f.label}
                {f.id !== "all" && count > 0 && <span className="ml-1 text-[10px] text-slate-400">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!loaded &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 px-4 py-4">
              <div className="size-9 rounded-full bg-slate-100" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-3 w-2/3" />
                <Shimmer className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        {loaded && visible.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-400">{cards.length === 0 ? "Aún no hay conversaciones." : "Sin resultados."}</p>
        )}
        {visible.map((card, index) => {
          const active = card.id === selectedId;
          return (
            <button
              key={card.id}
              onClick={() => onSelect(card.id)}
              style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
              className={`animate-fade-up relative w-full text-left px-4 py-3.5 transition-colors ${
                active ? "bg-navy-50" : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-navy-900 transition-transform duration-300 origin-center ${
                  active ? "scale-y-100" : "scale-y-0"
                }`}
              />
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar name={card.contactName} />
                  {card.needsAttention && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{card.contactName}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{relative(card.lastMessageAt, now)}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">{card.courseName ?? "Sin curso identificado"}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <IntentBadge state={card.intentState} />
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      {card.mode === "human" ? <UserIcon className="size-3" /> : <BotIcon className="size-3" />}
                      {card.mode === "human" ? "Operador" : "IA"}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Groups messages under a date divider whenever the day changes. */
function withDayDividers(messages: Message[]): ({ kind: "day"; label: string } | { kind: "message"; message: Message })[] {
  const items: ({ kind: "day"; label: string } | { kind: "message"; message: Message })[] = [];
  let lastDay = "";
  for (const message of messages) {
    const label = day(message.createdAt);
    if (label !== lastDay) items.push({ kind: "day", label });
    lastDay = label;
    items.push({ kind: "message", message });
  }
  return items;
}

export function Chats() {
  const router = useRouter();
  const [cards, setCards] = useState<ConversationCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    // Skip a tick while the previous refresh is still running, so slow responses never pile up.
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [list, chat] = await Promise.all([
        getJson<ConversationCard[]>("/api/operator/conversations"),
        selectedId ? getJson<ConversationDetail>(`/api/operator/conversations/${selectedId}`) : Promise.resolve(null),
      ]);
      if (list === "unauthorized" || chat === "unauthorized") {
        router.replace("/login");
        return;
      }
      if (list) {
        setCards(list);
        setLoaded(true);
      }
      if (chat) setDetail(chat);
      setNow(Date.now());
    } finally {
      inFlight.current = false;
    }
  }, [router, selectedId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Deep link from other views: /dashboard/chats?c=<conversation id>.
  useEffect(() => {
    const linked = Number(new URLSearchParams(window.location.search).get("c"));
    if (Number.isInteger(linked) && linked > 0) setSelectedId(linked);
  }, []);

  const messageCount = detail?.messages.length ?? 0;
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messageCount, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function act(path: string, success: string, body?: object): Promise<boolean> {
    if (!selectedId) return false;
    setBusy(true);
    const response = await fetch(`/api/operator/conversations/${selectedId}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setToast({ text: success, error: false });
    } else {
      const result = (await response?.json().catch(() => null)) as { error?: string; detail?: string } | null;
      setToast({
        error: true,
        text:
          result?.error === "not_found"
            ? "La conversación ya no existe."
            : `No se pudo completar la acción${result?.detail ? `: ${result.detail}` : ". Intenta de nuevo."}`,
      });
    }
    await refresh();
    return response?.ok ?? false;
  }

  async function send() {
    if (!draft.trim() || busy) return;
    if (await act("messages", "Mensaje enviado por Telegram", { text: draft })) {
      setDraft("");
      if (inputRef.current) inputRef.current.style.height = "";
    }
  }

  function select(id: number) {
    setSelectedId(id);
    setDetail(null);
    setDraft("");
  }

  const selected = detail && detail.id === selectedId ? detail : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-navy-900">Conversaciones</h1>
        <p className="text-sm text-slate-500">Chats de Telegram atendidos por la IA y por los operadores.</p>
      </div>

      <div className="flex-1 flex min-h-0 mx-6 mb-6 rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <aside className={`w-full md:w-80 shrink-0 border-r border-slate-100 flex-col ${selectedId ? "hidden md:flex" : "flex"}`}>
          <ConversationList cards={cards} loaded={loaded} selectedId={selectedId} onSelect={select} now={now} />
        </aside>

        <section className={`flex-1 flex-col min-w-0 bg-slate-50/60 ${selectedId ? "flex" : "hidden md:flex"}`}>
          {!selectedId ? (
            <div className="flex-1 grid place-items-center text-center p-6">
              <div className="animate-fade-up">
                <div className="mx-auto size-14 rounded-2xl bg-navy-50 ring-1 ring-navy-100 grid place-items-center text-navy-700">
                  <ChatIcon className="size-6" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-700">Ninguna conversación seleccionada</p>
                <p className="mt-1 text-xs text-slate-400">Elige un chat de la lista para verlo y responder.</p>
              </div>
            </div>
          ) : !selected ? (
            <div className="flex-1 grid place-items-center">
              <div className="size-6 rounded-full border-2 border-navy-200 border-t-navy-900 animate-spin" />
            </div>
          ) : (
            <div key={selected.id} className="animate-slide-in flex-1 flex flex-col min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-white border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelectedId(null)} className="md:hidden -ml-1 p-1 text-slate-500" aria-label="Volver">
                    <BackIcon />
                  </button>
                  <Avatar name={selected.contactName} size="size-10" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-slate-900 truncate">{selected.contactName}</h2>
                      {selected.username && <span className="text-xs text-slate-400">@{selected.username}</span>}
                      <IntentBadge state={selected.intentState} />
                      {selected.needsAttention && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 rounded-full px-2 py-0.5">
                          <AlertIcon className="size-3" /> Requiere atención
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {selected.courseName ?? "Sin curso identificado"} ·{" "}
                      {selected.mode === "human" ? "Operador al mando, IA en pausa" : "Atendida por la IA"}
                    </p>
                  </div>
                </div>
                {selected.mode === "ai" ? (
                  <button
                    disabled={busy}
                    onClick={() => act("take-over", "Tomaste el control. La IA está en pausa.")}
                    className="inline-flex items-center gap-2 text-sm font-medium bg-navy-900 hover:bg-navy-800 active:scale-[0.98] disabled:opacity-50 text-white rounded-lg px-4 py-2 shadow-sm transition-all"
                  >
                    <UserIcon className="size-4" /> Tomar el control
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => act("resume", "La IA retomó la conversación.")}
                    className="inline-flex items-center gap-2 text-sm font-medium ring-1 ring-navy-900/20 text-navy-900 bg-white hover:bg-navy-50 active:scale-[0.98] disabled:opacity-50 rounded-lg px-4 py-2 transition-all"
                  >
                    <BotIcon className="size-4" /> Devolver a la IA
                  </button>
                )}
              </div>

              {selected.summary && (
                <div className="mx-5 mt-4 rounded-xl bg-white ring-1 ring-slate-200/70 px-4 py-3 text-xs text-slate-600 leading-relaxed">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-navy-700 mb-1">Resumen de la conversación</span>
                  {selected.summary}
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
                {withDayDividers(selected.messages).map((item) =>
                  item.kind === "day" ? (
                    <div key={`day-${item.label}`} className="self-center my-2 text-[11px] text-slate-400 bg-white ring-1 ring-slate-200/70 rounded-full px-3 py-0.5 capitalize">
                      {item.label}
                    </div>
                  ) : (
                    <div
                      key={item.message.id}
                      className={`animate-fade-up max-w-[78%] md:max-w-[65%] rounded-2xl px-4 py-2.5 text-sm ${ROLE[item.message.role].bubble} ${ROLE[item.message.role].align}`}
                    >
                      <div className={`text-[10px] font-medium uppercase tracking-wider mb-1 ${ROLE[item.message.role].meta}`}>
                        {ROLE[item.message.role].label} · {clock(item.message.createdAt)}
                      </div>
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{item.message.content}</div>
                    </div>
                  ),
                )}
                <div ref={bottomRef} />
              </div>

              <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex items-end gap-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus-within:ring-navy-700 focus-within:bg-white px-3 py-2 transition-all">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    maxLength={4000}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Escribe una respuesta…  (Enter para enviar, Shift+Enter para nueva línea)"
                    className="flex-1 resize-none bg-transparent text-sm outline-none py-1.5 placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={busy || !draft.trim()}
                    aria-label="Enviar"
                    className="size-9 shrink-0 grid place-items-center rounded-lg bg-navy-900 hover:bg-navy-800 active:scale-95 disabled:opacity-30 text-white transition-all"
                  >
                    <SendIcon className="size-4" />
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Al enviar, la IA queda en pausa hasta que la devuelvas.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div
          role="status"
          className={`animate-fade-up fixed bottom-6 right-6 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${
            toast.error ? "bg-white text-rose-700 ring-rose-200" : "bg-navy-900 text-white ring-navy-800"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

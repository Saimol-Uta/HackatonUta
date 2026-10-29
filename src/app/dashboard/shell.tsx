"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChartIcon, ChatIcon, LogoutIcon } from "./icons";

const NAV = [
  { href: "/dashboard", label: "Métricas", icon: ChartIcon },
  { href: "/dashboard/chats", label: "Conversaciones", icon: ChatIcon },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="h-screen flex flex-col md:flex-row">
      <aside className="md:w-60 shrink-0 bg-navy-900 text-white flex md:flex-col">
        <div className="flex items-center gap-3 px-5 h-14 md:h-16 md:border-b md:border-white/10">
          <div className="size-8 rounded-lg bg-white/10 ring-1 ring-white/15 grid place-items-center text-[11px] font-bold tracking-wide">CTT</div>
          <div className="hidden sm:block leading-tight">
            <div className="text-sm font-semibold">Agente de ventas</div>
            <div className="text-[11px] text-navy-200/70">CTT FISEI · UTA</div>
          </div>
        </div>

        <nav className="flex md:flex-col gap-1 px-3 md:py-4 items-center md:items-stretch flex-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-white/10 text-white" : "text-navy-100/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {active && <span className="hidden md:block absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-white" />}
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex md:flex-col items-center md:items-stretch gap-2 px-3 md:p-4 md:border-t md:border-white/10">
          <span className="hidden md:inline-flex items-center gap-2 px-3 text-[11px] text-navy-100/70">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Actualización en vivo
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-navy-100/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogoutIcon className="size-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}

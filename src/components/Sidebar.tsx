"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

type NavItem =
  | { kind: "link"; href: string; label: string; icon: ReactNode; roles: string[] }
  | { kind: "divider" };

// roles: [] = todos; ["ADMIN"] = só admin; ["ADMIN","SOCIO"] = admin e sócio
const navItems: NavItem[] = [
  {
    kind: "link", href: "/dashboard", label: "Painel", roles: [],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    kind: "link", href: "/dashboard/publicacoes", label: "Publicações", roles: ["ADMIN", "SOCIO"],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>,
  },
  {
    kind: "link", href: "/dashboard/processos-judiciais", label: "Processos Judiciais", roles: [],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
  },
  {
    kind: "link", href: "/dashboard/consultivo", label: "Consultivo", roles: [],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  { kind: "divider" },
  {
    kind: "link", href: "/dashboard/arquivados", label: "Arquivados", roles: [],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  },
  {
    kind: "link", href: "/dashboard/relatorios", label: "Relatórios", roles: [],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  { kind: "divider" },
  {
    kind: "link", href: "/dashboard/auditoria", label: "Auditoria", roles: ["ADMIN"],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    kind: "link", href: "/dashboard/backup", label: "Backup", roles: ["ADMIN"],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 8 3s8-1 8-3V7M4 7c0 2 1.5 3 8 3s8-1 8-3M4 7c0-2 1.5-3 8-3s8 1 8 3" /></svg>,
  },
  {
    kind: "link", href: "/dashboard/usuarios", label: "Usuários", roles: ["ADMIN"],
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
];

function SidebarContent() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const [open, setOpen] = useState(false);

  function isVisible(item: NavItem): boolean {
    if (item.kind === "divider") return true;
    if (item.roles.length === 0) return true;
    return item.roles.includes(role);
  }

  function isActive(item: NavItem): boolean {
    if (item.kind === "divider") return false;
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-center border-b border-white/10 bg-navy-800 px-4 text-white lg:hidden">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-navy-300">
          Gestão de Processos
        </span>
      </div>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-navy-800 text-white shadow-xl ring-1 ring-gold-500/50 transition active:scale-95 lg:hidden"
        >
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden" aria-hidden="true" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-800 text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <button
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-navy-300 transition hover:bg-navy-700 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Logo CPA */}
        <div className="border-b border-white/10 px-5 py-7 flex flex-col items-center">
          <svg width="48" height="42" viewBox="0 0 48 42" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-3">
            <polygon points="24,1 47,41 1,41" fill="none" stroke="#c4a44a" strokeWidth="2"/>
            <polygon points="14,27 24,8 34,27" fill="none" stroke="#c4a44a" strokeWidth="1.5"/>
          </svg>
          <p className="text-white text-[0.7rem] font-bold tracking-[0.25em] uppercase leading-tight">Cavalcanti & Pinto</p>
          <p className="text-white text-[0.7rem] font-bold tracking-[0.25em] uppercase leading-tight">de Azevedo</p>
          <div className="mx-auto mt-3 h-px w-10 bg-gold-500/50" />
          <p className="mt-2 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-navy-300">
            Gestão de Processos
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-5 overflow-y-auto">
          {navItems.filter(isVisible).map((item, idx) => {
            if (item.kind === "divider") {
              return <div key={`div-${idx}`} className="my-2 border-t border-white/10" />;
            }

            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition ${active ? "border-gold-500 bg-navy-700 text-white" : "border-transparent text-navy-300 hover:bg-navy-700/60 hover:text-white"}`}
              >
                <span className={active ? "text-gold-400" : "text-navy-400"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="mb-2 px-3 py-2">
            <p className="truncate text-sm font-medium text-white">{session?.user?.name}</p>
            <p className="truncate text-xs text-navy-300">{session?.user?.email}</p>
            {role && (
              <span className="mt-2 inline-block rounded-full border border-gold-500/40 bg-gold-500/10 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-gold-300">
                {role === "ADMIN" ? "Administrador" : role === "SOCIO" ? "Sócio" : "Estagiário"}
              </span>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-navy-300 transition hover:bg-navy-700/60 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={<aside className="hidden min-h-screen w-64 flex-col bg-navy-800 lg:flex" />}>
      <SidebarContent />
    </Suspense>
  );
}

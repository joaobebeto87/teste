import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { getDeadlineStatus, deadlineRowClass, deadlineCellClass, deadlineBadgeClass, deadlineBadgeText, statusBadgeClass, statusLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const isAdmin = session!.user.role === "ADMIN";
  const now = new Date();

  const openDeadlineWhere: Prisma.ProcessWhereInput = {
    status: "ATIVO",
    OR: [{ deadline: null }, { deadline: { gte: now } }],
  };

  const [
    totalProcesses,
    activeProcesses,
    openDeadlineTotal,
    openJudicialCount,
    openAdminCount,
    pendingTasks,
    prefeituraCount,
    prefeituraOpenCount,
    escritorioCount,
    escritorioOpenCount,
    comTarefaCount,
    comTarefaJudicialCount,
    comTarefaAdminCount,
    tasksByUser,
  ] = await Promise.all([
    prisma.process.count(),
    prisma.process.findMany({
      where: { status: "ATIVO" },
      include: { createdBy: { select: { name: true } } },
      orderBy: { deadline: "asc" },
      take: 10,
    }),
    prisma.process.count({ where: openDeadlineWhere }),
    prisma.process.count({ where: { ...openDeadlineWhere, type: "JUDICIAL" } }),
    prisma.process.count({ where: { ...openDeadlineWhere, type: "ADMINISTRATIVO" } }),
    prisma.task.count({
      where: { assignedToId: session!.user.id, status: { not: "CONCLUIDA" } },
    }),
    prisma.process.count({ where: { client: "PREFEITURA" } }),
    prisma.process.count({ where: { client: "PREFEITURA", ...openDeadlineWhere } }),
    prisma.process.count({ where: { client: "ESCRITORIO" } }),
    prisma.process.count({ where: { client: "ESCRITORIO", ...openDeadlineWhere } }),
    prisma.process.count({ where: { tasks: { some: {} } } }),
    prisma.process.count({ where: { tasks: { some: {} }, type: "JUDICIAL" } }),
    prisma.process.count({ where: { tasks: { some: {} }, type: "ADMINISTRATIVO" } }),
    isAdmin
      ? prisma.user.findMany({
          where: { name: { in: ["Pedro Morais", "Lígia Rafaela"] } },
          select: {
            id: true,
            name: true,
            tasksReceived: {
              where: { status: { not: "CONCLUIDA" } },
              select: { id: true, deadline: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const expiring = activeProcesses.filter((p) => p.deadline && differenceInCalendarDays(new Date(p.deadline), now) <= 3);
  const expired = activeProcesses.filter((p) => p.deadline && differenceInCalendarDays(new Date(p.deadline), now) < 0);

  function urgencyColors(tasks: { deadline: Date }[]): { border: string; chip: string; text: string } {
    let hue = 120;
    if (tasks.length > 0) {
      const MAX_TASKS = 10;
      const HORIZON_DAYS = 14;
      const countScore = Math.min(tasks.length / MAX_TASKS, 1);
      const timeScore =
        tasks.reduce((sum, t) => {
          const d = differenceInCalendarDays(new Date(t.deadline), now);
          return sum + (d <= 0 ? 1 : Math.max(0, 1 - d / HORIZON_DAYS));
        }, 0) / tasks.length;
      hue = Math.round((1 - (countScore + timeScore) / 2) * 120);
    }
    return {
      border: `hsl(${hue},72%,40%)`,
      chip: `hsl(${hue},60%,93%)`,
      text: `hsl(${hue},72%,40%)`,
    };
  }

  const iconCls = "w-5 h-5";
  const cards = [
    {
      label: "Total de Processos", value: totalProcesses, tone: "navy",
      href: "/dashboard/processos",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    },
    {
      label: "Prazo em Aberto", value: openDeadlineTotal, tone: "gold",
      subCounts: [
        { label: "Judicial", value: openJudicialCount, href: "/dashboard/processos-judiciais?prazo=aberto" },
        { label: "Administrativo", value: openAdminCount, href: "/dashboard/processos?prazo=aberto" },
      ],
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    },
    {
      label: "Vencendo em 3 dias", value: expiring.length, tone: "amber",
      href: "/dashboard/processos?prazo=vencendo",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    },
    {
      label: "Prazo Expirado", value: expired.length, tone: "red",
      href: "/dashboard/processos?prazo=expirado",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3l-6.93-12a2 2 0 00-3.48 0l-6.93 12a2 2 0 001.74 3z" />,
    },
    ...(isAdmin
      ? (["Pedro Morais", "Lígia Rafaela"] as const).map((nome) => {
          const u = tasksByUser.find((x) => x.name === nome);
          const tasks = u ? u.tasksReceived : [];
          const colors = urgencyColors(tasks);
          return {
            label: `Tarefas — ${nome.split(" ")[0]}`,
            value: tasks.length,
            tone: "navy" as const,
            urgency: colors,
            href: u ? `/dashboard/caixa-entrada?assignee=${u.id}` : "/dashboard/caixa-entrada",
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />,
          };
        })
      : [
          {
            label: "Tarefas Pendentes",
            value: pendingTasks,
            tone: "navy" as const,
            href: "/dashboard/caixa-entrada",
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />,
          },
        ]),
    {
      label: "Processos da Prefeitura", value: prefeituraCount, tone: "sky",
      href: "/dashboard/processos-judiciais?client=PREFEITURA",
      subCounts: [{ label: "Prazo em Aberto", value: prefeituraOpenCount, href: "/dashboard/processos-judiciais?client=PREFEITURA&prazo=aberto" }],
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />,
    },
    {
      label: "Processos do Escritório", value: escritorioCount, tone: "navy",
      href: "/dashboard/processos-judiciais?client=ESCRITORIO",
      subCounts: [{ label: "Prazo em Aberto", value: escritorioOpenCount, href: "/dashboard/processos-judiciais?client=ESCRITORIO&prazo=aberto" }],
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3m4-14h.01M11 7h.01M15 7h.01M7 11h.01M11 11h.01M15 11h.01M7 15h2.5m3.5 0h2" />,
    },
    {
      label: "Com Tarefa Vinculada", value: comTarefaCount, tone: "emerald",
      subCounts: [
        { label: "Judicial", value: comTarefaJudicialCount, href: "/dashboard/processos-judiciais?comTarefa=true" },
        { label: "Administrativo", value: comTarefaAdminCount, href: "/dashboard/processos?comTarefa=true" },
      ],
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" />,
    },
  ];
  const toneNumber: Record<string, string> = {
    navy: "text-navy-800", gold: "text-gold-600", amber: "text-amber-600", red: "text-red-600",
    sky: "text-sky-600", emerald: "text-emerald-600",
  };
  const toneChip: Record<string, string> = {
    navy: "bg-navy-50 text-navy-700", gold: "bg-gold-100 text-gold-700",
    amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600",
    sky: "bg-sky-50 text-sky-700", emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="eyebrow mb-1">Painel de Controle</p>
        <h1 className="page-title">Bem-vindo, {session?.user?.name?.split(" ")[0]}.</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const u = "urgency" in card ? card.urgency : undefined;
          const href = "href" in card ? card.href : undefined;
          return (
            <div
              key={card.label}
              className={`card p-5 relative ${href ? "transition-shadow hover:shadow-md" : ""}`}
              style={u ? { borderColor: u.border, borderWidth: "2px" } : undefined}
            >
              {href && (
                <Link href={href} aria-label={card.label} className="absolute inset-0 z-10 rounded-[inherit]" />
              )}
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${u ? "" : toneChip[card.tone]}`}
                style={u ? { backgroundColor: u.chip, color: u.text } : undefined}
              >
                <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">{card.icon}</svg>
              </span>
              <p
                className={`mt-4 text-3xl font-bold tracking-tight tabular-nums ${u ? "" : toneNumber[card.tone]}`}
                style={u ? { color: u.text } : undefined}
              >
                {card.value}
              </p>
              <p className="mt-1 text-[0.7rem] font-medium uppercase tracking-wider leading-snug text-stone-500">{card.label}</p>
              {"subCounts" in card && card.subCounts && (
                <div className="relative z-20 mt-3 flex flex-wrap gap-2">
                  {card.subCounts.map((sub) => {
                    const chipCls = "flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-stone-600 transition-colors";
                    const inner = (
                      <>
                        <span className={toneNumber[card.tone]}>{sub.value}</span>
                        <span className="text-stone-400">{sub.label}</span>
                      </>
                    );
                    return "href" in sub && sub.href ? (
                      <Link key={sub.label} href={sub.href} className={`${chipCls} hover:bg-stone-200`}>{inner}</Link>
                    ) : (
                      <span key={sub.label} className={chipCls}>{inner}</span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 className="section-title">Processos Ativos — Mais Urgentes</h2>
          <Link href="/dashboard/processos" className="text-sm font-medium text-gold-700 transition hover:text-gold-800">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
                <th className="px-6 py-3 font-medium">Nº Processo</th>
                <th className="px-6 py-3 font-medium">Assunto</th>
                <th className="px-6 py-3 font-medium">Responsável</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {activeProcesses.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-stone-400">Nenhum processo ativo.</td></tr>
              )}
              {activeProcesses.map((p, i) => {
                const status = getDeadlineStatus(p.deadline);
                const zebraClass = status !== "expired" ? (i % 2 === 0 ? "bg-white" : "bg-[#f7f5ef]") : "";
                return (
                  <tr key={p.id} className={`border-b border-stone-100 transition hover:bg-stone-100 ${deadlineRowClass(status)} ${zebraClass}`}>
                    <td className={`px-6 py-3 font-mono font-semibold ${deadlineCellClass(status)}`}>
                      <div className="flex items-center gap-2">
                        {p.client === "ESCRITORIO" && (
                          <span className="w-2.5 h-2.5 rounded-full bg-navy-700 flex-shrink-0" title="Escritório"></span>
                        )}
                        {p.client === "PREFEITURA" && (
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 flex-shrink-0" title="Prefeitura"></span>
                        )}
                        <Link href={`/dashboard/processos/${p.id}`} className="text-navy-700 transition hover:text-gold-700 hover:underline">
                          {p.number}
                        </Link>
                      </div>
                    </td>
                    <td className={`px-6 py-3 ${deadlineCellClass(status)}`}>{p.subject}</td>
                    <td className="px-6 py-3 text-stone-600">{p.createdBy.name}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {p.deadline ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${deadlineBadgeClass(status)}`}>
                          {format(new Date(p.deadline), "dd/MM/yyyy")} · {deadlineBadgeText(status, p.deadline)}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-xs">Sem prazo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

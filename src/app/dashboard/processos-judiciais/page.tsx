import { getServerSession } from "next-auth";
import { authOptions, canJudicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProcessTable, { ProcessRow, ProcessColumnKey } from "@/components/ProcessTable";

export default async function ProcessosJudiciaisPage({
  searchParams,
}: {
  searchParams: { client?: string; prazo?: string; comTarefa?: string; pai?: string };
}) {
  const session = await getServerSession(authOptions);
  const userCanJudicial = canJudicial(session?.user);

  // N1 assessors só veem processos da Prefeitura
  if (!userCanJudicial) {
    if (searchParams?.client !== "PREFEITURA") redirect("/dashboard/processos-judiciais?client=PREFEITURA");
  }

  const now = new Date();

  const activePai = searchParams?.pai === "1";

  const activeClient = activePai
    ? null
    : searchParams?.client === "PREFEITURA" ? "PREFEITURA"
    : searchParams?.client === "ESCRITORIO" ? "ESCRITORIO"
    : null;

  // "Do meu pai" = publicação só no nome do pai (contém PAULO, sem PROPRIO) e que
  // você ainda NÃO classificou (sem marcador). Quando recebe um marcador
  // (Prefeitura/Escritório), sai daqui e passa a aparecer na aba correspondente.
  const PAI_FILTER: Prisma.ProcessWhereInput = {
    AND: [
      { publicacaoOabs: { contains: "PAULO" } },
      { NOT: { publicacaoOabs: { contains: "PROPRIO" } } },
      { client: null },
    ],
  };

  // "Todos" (sem filtro) = todos exceto administrativos E exceto os ainda na aba do pai.
  // Com filtro de cliente = apenas judiciais daquele cliente (Prefeitura/Escritório).
  // "Do meu pai" = processos a triar (só o pai, sem marcador).
  const where: Prisma.ProcessWhereInput = activePai
    ? { status: { not: "ARQUIVADO" }, type: { not: "ADMINISTRATIVO" }, ...PAI_FILTER }
    : activeClient
    ? { status: { not: "ARQUIVADO" }, type: "JUDICIAL", client: activeClient }
    : { status: { not: "ARQUIVADO" }, type: { not: "ADMINISTRATIVO" }, NOT: PAI_FILTER };

  const partesFiltro: string[] = [];
  if (searchParams?.prazo === "aberto") {
    where.status = "ATIVO";
    where.OR = [{ deadline: null }, { deadline: { gte: now } }];
    partesFiltro.push("Prazo em Aberto");
  }
  if (searchParams?.comTarefa === "true") {
    where.tasks = { some: {} };
    partesFiltro.push("Com Tarefa Vinculada");
  }
  const filtroAtivo = partesFiltro.join(" · ");

  const [countTodos, countPrefeitura, countEscritorio, countPai, processes, lastSyncRow] = await Promise.all([
    prisma.process.count({ where: { status: { not: "ARQUIVADO" }, type: { not: "ADMINISTRATIVO" }, NOT: PAI_FILTER } }),
    prisma.process.count({ where: { status: { not: "ARQUIVADO" }, type: "JUDICIAL", client: "PREFEITURA" } }),
    prisma.process.count({ where: { status: { not: "ARQUIVADO" }, type: "JUDICIAL", client: "ESCRITORIO" } }),
    prisma.process.count({ where: { status: { not: "ARQUIVADO" }, type: { not: "ADMINISTRATIVO" }, ...PAI_FILTER } }),
    prisma.process.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        movements: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appConfig.findUnique({ where: { key: "pje_last_sync_at" } }),
  ]);

  // Horário da última sincronização: usado para destacar o que veio nela.
  const lastSyncMs = lastSyncRow?.value ? new Date(lastSyncRow.value).getTime() : null;
  const sameAsLastSync = (d: Date | null) => lastSyncMs !== null && d !== null && d.getTime() === lastSyncMs;

  const rows: ProcessRow[] = processes.map((p) => {
    const isNewFromSync = sameAsLastSync(p.syncCreatedAt);
    return {
      id: p.id,
      number: p.number,
      parties: p.parties,
      subject: p.subject,
      createdByName: p.createdBy.name,
      status: p.status,
      client: p.client,
      lastMovementAt: p.movements[0]?.createdAt.toISOString() ?? null,
      deadline: p.deadline ? p.deadline.toISOString() : null,
      isNewFromSync,
      // verde só se foi movimentado na última sync E não for um processo novo (que já fica azul)
      hasRecentSyncMovement: !isNewFromSync && sameAsLastSync(p.lastSyncMovementAt),
    };
  });

  const judicialColumns: ProcessColumnKey[] = [
    "marcador", "number", "parties", "subject", "createdByName", "status", "lastMovementAt", "deadline",
  ];

  const novoHref = activeClient
    ? `/dashboard/processos-judiciais/novo?defaultClient=${activeClient}`
    : "/dashboard/processos-judiciais/novo";

  const limparFiltroHref = activePai
    ? "/dashboard/processos-judiciais?pai=1"
    : activeClient
    ? `/dashboard/processos-judiciais?client=${activeClient}`
    : "/dashboard/processos-judiciais";

  const tabs: { key: string | null; label: string; count: number; href: string }[] = [
    ...(userCanJudicial
      ? [{ key: null, label: "Todos", count: countTodos, href: "/dashboard/processos-judiciais" }]
      : []),
    { key: "PREFEITURA", label: "Prefeitura", count: countPrefeitura, href: "/dashboard/processos-judiciais?client=PREFEITURA" },
    ...(userCanJudicial
      ? [{ key: "ESCRITORIO", label: "Escritório", count: countEscritorio, href: "/dashboard/processos-judiciais?client=ESCRITORIO" }]
      : []),
    ...(userCanJudicial
      ? [{ key: "PAI", label: "Do meu pai", count: countPai, href: "/dashboard/processos-judiciais?pai=1" }]
      : []),
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Acervo · Processos Judiciais</p>
          <h1 className="page-title">Processos Judiciais</h1>
          <p className="text-stone-500 text-sm mt-1">
            {processes.length} processo(s){filtroAtivo ? " · " : " cadastrado(s)"}
            {filtroAtivo && (
              <>
                <span className="font-medium text-navy-700">{filtroAtivo}</span>
                {" "}
                <Link href={limparFiltroHref} className="text-gold-700 hover:text-gold-800 hover:underline">
                  (limpar filtro)
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href={novoHref} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Processo Judicial
        </Link>
      </div>

      <div className="flex gap-1.5 mb-4">
        {tabs.map((tab) => {
          const active =
            tab.key === "PAI" ? activePai
            : tab.key === null ? (!activeClient && !activePai)
            : (!activePai && activeClient === tab.key);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
                active
                  ? tab.key === "PREFEITURA"
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : tab.key === "ESCRITORIO"
                    ? "bg-navy-50 text-navy-700 border-navy-200"
                    : tab.key === "PAI"
                    ? "bg-amethyst-50 text-amethyst-700 border-amethyst-200"
                    : "bg-stone-100 text-stone-800 border-stone-300"
                  : "text-stone-500 border-transparent hover:text-navy-700 hover:bg-stone-50 hover:border-stone-200"
              }`}
            >
              {tab.key === "PREFEITURA" && (
                <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0"></span>
              )}
              {tab.key === "ESCRITORIO" && (
                <span className="w-2 h-2 rounded-full bg-navy-700 flex-shrink-0"></span>
              )}
              {tab.key === "PAI" && (
                <span className="w-2 h-2 rounded-full bg-amethyst-500 flex-shrink-0"></span>
              )}
              {tab.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-normal ${active ? "bg-white/70 text-stone-600" : "bg-stone-100 text-stone-500"}`}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {activePai && (
        <div className="mb-4 rounded-lg border border-amethyst-200 bg-amethyst-50 px-4 py-3 text-sm text-amethyst-800">
          Processos em que <strong>apenas o seu pai</strong> aparece nas publicações. Abra um processo e
          defina o <strong>Marcador</strong> (Prefeitura ou Escritório) para classificá-lo — ele sai
          desta aba automaticamente.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="mb-2 px-6 pt-4 pb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500 border-b border-stone-100">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block"></span> Vence em 3 dias</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block"></span> Menos de 3 dias</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Prazo expirado</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-200 border border-sky-300 inline-block"></span> Novo na última sincronização</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-300 inline-block"></span> Movimentado na última sincronização</span>
          {!activeClient && (
            <span className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-navy-700 inline-block"></span> Escritório</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span> Prefeitura</span>
            </span>
          )}
        </div>
        <ProcessTable
          rows={rows}
          columns={judicialColumns}
          syncHighlight
          emptyLabel="Nenhum processo judicial cadastrado."
        />
      </div>
    </div>
  );
}

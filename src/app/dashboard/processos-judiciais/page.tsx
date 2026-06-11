import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProcessTable, { ProcessRow, ProcessColumnKey } from "@/components/ProcessTable";

export default async function ProcessosJudiciaisPage({
  searchParams,
}: {
  searchParams: { prazo?: string; comTarefa?: string; marcador?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const now = new Date();

  const where: Prisma.ProcessWhereInput = {
    status: { not: "ARQUIVADO" },
    type: "JUDICIAL",
  };

  const partesFiltro: string[] = [];

  if (searchParams?.prazo === "aberto") {
    where.OR = [{ deadline: null }, { deadline: { gte: now } }];
    partesFiltro.push("Prazo em Aberto");
  }
  if (searchParams?.comTarefa === "true") {
    where.tasks = { some: {} };
    partesFiltro.push("Com Tarefa Vinculada");
  }
  if (searchParams?.marcador === "civel") {
    where.client = "CIVEL";
    partesFiltro.push("Cível");
  } else if (searchParams?.marcador === "trabalhista") {
    where.client = "TRABALHISTA";
    partesFiltro.push("Trabalhista");
  }

  const filtroAtivo = partesFiltro.join(" · ");

  const [totalCount, processes, lastSyncRow] = await Promise.all([
    prisma.process.count({ where: { status: { not: "ARQUIVADO" }, type: "JUDICIAL" } }),
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

  const lastSyncMs = lastSyncRow?.value ? new Date(lastSyncRow.value).getTime() : null;
  const sameAsLastSync = (d: Date | null) =>
    lastSyncMs !== null && d !== null && d.getTime() === lastSyncMs;

  const rows: ProcessRow[] = (processes as any[]).map((p) => {
    const isNewFromSync = sameAsLastSync(p.syncCreatedAt);
    return {
      id: p.id,
      number: p.number,
      parties: p.parties,
      clientName: p.clientName,
      subject: p.subject,
      createdByName: p.createdBy.name,
      status: p.status,
      client: p.client,
      lastMovementAt: p.movements[0]?.createdAt.toISOString() ?? null,
      deadline: p.deadline ? p.deadline.toISOString() : null,
      isNewFromSync,
      hasRecentSyncMovement: !isNewFromSync && sameAsLastSync(p.lastSyncMovementAt),
    };
  });

  const columns: ProcessColumnKey[] = [
    "marcador", "number", "clientName", "parties", "subject", "status", "lastMovementAt", "deadline",
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Acervo</p>
          <h1 className="page-title">Processos Judiciais</h1>
          <p className="text-stone-500 text-sm mt-1">
            {totalCount} processo(s) cadastrado(s)
            {filtroAtivo && (
              <>
                {" · "}
                <span className="font-medium text-navy-700">{filtroAtivo}</span>
                {" "}
                <Link href="/dashboard/processos-judiciais" className="text-gold-700 hover:text-gold-800 hover:underline">
                  (limpar filtro)
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href="/dashboard/processos-judiciais/novo" className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Processo
        </Link>
      </div>

      {/* Filtros rápidos por marcador */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link
          href="/dashboard/processos-judiciais"
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            !searchParams?.marcador
              ? "bg-stone-100 text-stone-800 border-stone-300"
              : "text-stone-500 border-transparent hover:text-navy-700 hover:bg-stone-50 hover:border-stone-200"
          }`}
        >
          Todos
          <span className="text-[0.65rem] rounded-full px-1.5 py-0.5 bg-stone-200 text-stone-600">{totalCount}</span>
        </Link>
        <Link
          href="/dashboard/processos-judiciais?marcador=civel"
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            searchParams?.marcador === "civel"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "text-stone-500 border-transparent hover:text-blue-700 hover:bg-stone-50 hover:border-stone-200"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
          Cível
        </Link>
        <Link
          href="/dashboard/processos-judiciais?marcador=trabalhista"
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            searchParams?.marcador === "trabalhista"
              ? "bg-red-50 text-red-700 border-red-200"
              : "text-stone-500 border-transparent hover:text-red-700 hover:bg-stone-50 hover:border-stone-200"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
          Trabalhista
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="mb-2 px-6 pt-4 pb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500 border-b border-stone-100">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block"></span> Vence em 3 dias</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block"></span> Menos de 3 dias</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Prazo expirado</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-200 border border-sky-300 inline-block"></span> Novo na última sincronização</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-300 inline-block"></span> Movimentado na última sincronização</span>
        </div>
        <ProcessTable
          rows={rows}
          columns={columns}
          syncHighlight
          emptyLabel="Nenhum processo judicial cadastrado."
        />
      </div>
    </div>
  );
}

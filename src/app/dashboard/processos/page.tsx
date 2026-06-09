import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import ProcessTable, { ProcessRow, ProcessColumnKey } from "@/components/ProcessTable";

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: { prazo?: string; comTarefa?: string };
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  const now = new Date();

  const where: Prisma.ProcessWhereInput = { status: { not: "ARQUIVADO" }, type: "ADMINISTRATIVO" };

  if (searchParams?.prazo === "aberto") {
    where.status = "ATIVO";
    where.OR = [{ deadline: null }, { deadline: { gte: now } }];
  } else if (searchParams?.prazo === "vencendo") {
    const limite = new Date(now);
    limite.setDate(limite.getDate() + 3);
    where.status = "ATIVO";
    where.deadline = { gte: now, lte: limite };
  } else if (searchParams?.prazo === "expirado") {
    where.status = "ATIVO";
    where.deadline = { lt: now };
  }
  if (searchParams?.comTarefa === "true") {
    where.tasks = { some: {} };
  }

  const filtroLabels: Record<string, string> = {
    aberto: "Prazo em Aberto",
    vencendo: "Vencendo em 3 dias",
    expirado: "Prazo Expirado",
  };
  const filtroAtivo =
    (searchParams?.prazo && filtroLabels[searchParams.prazo]) ||
    (searchParams?.comTarefa === "true" ? "Com Tarefa Vinculada" : "");

  const processes = await prisma.process.findMany({
    where,
    include: {
      createdBy: { select: { name: true } },
      movements: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: ProcessRow[] = processes.map((p) => ({
    id: p.id,
    number: p.number,
    subject: p.subject,
    createdByName: p.createdBy.name,
    status: p.status,
    lastMovementAt: p.movements[0]?.createdAt.toISOString() ?? null,
    deadline: p.deadline ? p.deadline.toISOString() : null,
  }));

  const adminColumns: ProcessColumnKey[] = [
    "number", "subject", "createdByName", "status", "lastMovementAt", "deadline",
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Acervo</p>
          <h1 className="page-title">Processos Administrativos</h1>
          <p className="text-stone-500 text-sm mt-1">
            {processes.length} processo(s){filtroAtivo ? " · " : " cadastrado(s)"}
            {filtroAtivo && (
              <>
                <span className="font-medium text-navy-700">{filtroAtivo}</span>
                {" "}
                <Link href="/dashboard/processos" className="text-gold-700 hover:text-gold-800 hover:underline">
                  (limpar filtro)
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href="/dashboard/processos/novo" className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Processo
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="mb-2 px-6 pt-4 pb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500 border-b border-stone-100">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block"></span> Vence em 3 dias</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block"></span> Menos de 3 dias</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Prazo expirado</span>
        </div>
        <ProcessTable
          rows={rows}
          columns={adminColumns}
          emptyLabel={filtroAtivo ? `Nenhum processo com o filtro "${filtroAtivo}".` : "Nenhum processo cadastrado."}
        />
      </div>
    </div>
  );
}

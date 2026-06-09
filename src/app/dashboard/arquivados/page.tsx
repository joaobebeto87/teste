import { getServerSession } from "next-auth";
import { authOptions, canJudicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProcessTable, { ProcessRow, ProcessColumnKey } from "@/components/ProcessTable";

export default async function ArquivadosPage() {
  const session = await getServerSession(authOptions);
  const canJud = canJudicial(session?.user);

  const processes = await prisma.process.findMany({
    where: { status: "ARQUIVADO", ...(canJud ? {} : { type: "ADMINISTRATIVO" }) },
    include: { createdBy: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const rows: ProcessRow[] = processes.map((p) => ({
    id: p.id,
    number: p.number,
    type: p.type,
    subject: p.subject,
    createdByName: p.createdBy.name,
    deadline: p.deadline ? p.deadline.toISOString() : null,
    archivedAt: p.updatedAt.toISOString(),
  }));

  const arquivadosColumns: ProcessColumnKey[] = [
    "number", "tipo", "subject", "createdByName", "deadline", "archivedAt",
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <p className="eyebrow mb-1">Arquivo</p>
        <h1 className="page-title">Processos Arquivados</h1>
        <p className="text-stone-500 text-sm mt-1">
          {processes.length} processo(s) arquivado(s). Os processos aqui ficam preservados — nada é excluído.
        </p>
      </div>

      <div className="card overflow-hidden">
        <ProcessTable
          rows={rows}
          columns={arquivadosColumns}
          deadlineColoring={false}
          emptyLabel="Nenhum processo arquivado."
        />
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { statusBadgeClass, statusLabel, getDeadlineStatus, deadlineBadgeClass, deadlineBadgeText } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProcessoDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  await getServerSession(authOptions);

  const process = await prisma.process.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      movements: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!process) notFound();

  const isAdministrativo = process.type === "ADMINISTRATIVO";
  const backHref = isAdministrativo ? "/dashboard/processos" : "/dashboard/processos-judiciais";
  const backLabel = isAdministrativo ? "Consultivo" : "Processos Judiciais";
  const deadlineStatus = getDeadlineStatus(process.deadline?.toISOString() ?? null);

  function clientLabel(c: string | null) {
    if (c === "ESCRITORIO") return "Civel";
    if (c === "PREFEITURA") return "Pessoal";
    return c ?? "nao classificado";
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="text-stone-400 transition hover:text-navy-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="eyebrow">{backLabel}</p>
          <h1 className="page-title mt-0.5">{process.subject}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">
            {isAdministrativo ? "Demanda" : "Processo"}
          </p>
          <p className="font-mono font-semibold text-navy-800 text-sm">{process.number}</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Status</p>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(process.status)}`}>
            {statusLabel(process.status)}
          </span>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Prazo Fatal</p>
          {process.deadline ? (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${deadlineBadgeClass(deadlineStatus)}`}>
              {format(process.deadline, "dd/MM/yyyy")}
              <span className="opacity-70">· {deadlineBadgeText(deadlineStatus, process.deadline.toISOString())}</span>
            </span>
          ) : (
            <p className="text-stone-400 text-sm">sem prazo</p>
          )}
        </div>

        {isAdministrativo ? (
          <>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Cliente</p>
              <p className="text-sm text-stone-700">{process.parties || "—"}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Responsavel</p>
              <p className="text-sm text-stone-700">{process.category || "—"}</p>
            </div>
          </>
        ) : (
          <>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Partes</p>
              <p className="text-sm text-stone-700 truncate">{process.parties || "—"}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Marcador</p>
              <p className="text-sm text-stone-700">{clientLabel(process.client)}</p>
            </div>
          </>
        )}

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Cadastrado por</p>
          <p className="text-sm text-stone-700">{process.createdBy.name}</p>
        </div>
      </div>

      {process.description && (
        <div className="card p-5 mb-4">
          <h2 className="section-title mb-2">Descricao / Observacoes</h2>
          <p className="text-sm text-stone-600 whitespace-pre-wrap">{process.description}</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="section-title">Movimentacoes ({process.movements.length})</h2>
        </div>
        {process.movements.length === 0 ? (
          <div className="px-6 py-8 text-center text-stone-400 text-sm">
            Nenhuma movimentacao registrada.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {process.movements.map((m) => (
              <li key={m.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{m.description}</p>
                    <p className="text-xs text-stone-400 mt-1">{m.user.name}</p>
                  </div>
                  <span className="text-xs text-stone-400 whitespace-nowrap flex-shrink-0">
                    {format(m.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
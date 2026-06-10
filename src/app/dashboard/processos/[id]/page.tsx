import { getServerSession } from "next-auth";
import { authOptions, isSocioOrAbove } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { statusBadgeClass, statusLabel, getDeadlineStatus, deadlineBadgeClass, deadlineBadgeText } from "@/lib/utils";
import ProcessActions from "@/components/ProcessActions";
import HearingActions from "@/components/HearingActions";
import ProcessTaskDelegate from "@/components/ProcessTaskDelegate";

export const dynamic = "force-dynamic";

export default async function ProcessoDetalhePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) notFound();

  const [process, users] = await Promise.all([
    prisma.process.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { name: true } },
        movements: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } }, attachments: true },
        },
        tasks: {
          include: { assignedTo: { select: { name: true } }, assignedBy: { select: { name: true } } },
          orderBy: { deadline: "asc" },
        },
        hearings: {
          orderBy: { dateTime: "asc" },
          include: { createdBy: { select: { name: true } } },
        },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!process) notFound();

  const isJudicial = process.type === "JUDICIAL";
  const isStaff = isSocioOrAbove(session.user);
  const backHref = isJudicial ? "/dashboard/processos-judiciais" : "/dashboard/processos";
  const backLabel = isJudicial ? "Processos Judiciais" : "Processos";
  const deadlineStatus = getDeadlineStatus(process.deadline?.toISOString() ?? null);

  const hearingsSerial = process.hearings.map((h) => ({
    ...h,
    dateTime: h.dateTime.toISOString(),
  }));

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start gap-3 mb-6">
        <Link href={backHref} className="mt-1 text-stone-400 hover:text-navy-700 transition flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="eyebrow">{backLabel}</p>
          <h1 className="page-title mt-0.5 break-words">{process.subject}</h1>
          {process.clientName && (
            <p className="text-sm text-stone-500 mt-1">
              Cliente: <span className="font-medium text-navy-700">{process.clientName}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <ProcessActions
          processId={process.id}
          isAdmin={isStaff}
          canEdit={isStaff}
          canEditMarker={isJudicial && isStaff}
          processType={process.type}
          isJudicial={isJudicial}
          currentStatus={process.status}
          currentDeadline={process.deadline ? process.deadline.toISOString().split("T")[0] : null}
          currentClient={process.client}
          currentClientName={process.clientName ?? null}
          currentParties={process.parties ?? null}
          currentSubject={process.subject}
          currentDescription={process.description ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Numero</p>
          <p className="font-mono font-semibold text-navy-800 text-sm break-all">{process.number}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Status</p>
          <span className={"px-2 py-1 rounded-full text-xs font-medium " + statusBadgeClass(process.status)}>
            {statusLabel(process.status)}
          </span>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Prazo Fatal</p>
          {process.deadline ? (
            <span className={"inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium " + deadlineBadgeClass(deadlineStatus)}>
              {format(process.deadline, "dd/MM/yyyy")}
              <span className="opacity-70">· {deadlineBadgeText(deadlineStatus, process.deadline.toISOString())}</span>
            </span>
          ) : (
            <p className="text-stone-400 text-sm">Sem prazo</p>
          )}
        </div>
        {isJudicial ? (
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Marcador</p>
            {process.client === "ESCRITORIO" ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-700">
                <span className="w-2 h-2 rounded-full bg-navy-700"></span>Civel
              </span>
            ) : process.client === "PREFEITURA" ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>Pessoal
              </span>
            ) : (
              <span className="text-stone-400 text-xs">Sem marcador</span>
            )}
          </div>
        ) : (
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Cadastrado por</p>
            <p className="text-sm text-stone-700">{process.createdBy.name}</p>
          </div>
        )}
      </div>

      {(isJudicial && process.parties || process.description) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {isJudicial && process.parties && (
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Partes</p>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{process.parties}</p>
            </div>
          )}
          {process.description && (
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Descricao</p>
              <p className="text-sm text-stone-600 whitespace-pre-wrap">{process.description}</p>
            </div>
          )}
        </div>
      )}

      {isJudicial && (
        <div className="card p-6 mb-4">
          <h2 className="section-title mb-4">Audiencias e Compromissos</h2>
          <HearingActions
            processId={process.id}
            canAdd={true}
            hearings={hearingsSerial}
            currentUserId={session.user.id}
            isAdmin={isStaff}
          />
        </div>
      )}

      {isStaff && (
        <div className="card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Tarefas vinculadas ({process.tasks.length})</h2>
            <ProcessTaskDelegate processId={process.id} processNumber={process.number} users={users} />
          </div>
          {process.tasks.length > 0 ? (
            <div className="space-y-2">
              {process.tasks.map((t) => {
                const isDone = t.status === "CONCLUIDA";
                return (
                  <div key={t.id} className={"flex items-center justify-between rounded-lg border px-4 py-3 text-sm " + (isDone ? "border-stone-100 bg-stone-50" : "border-stone-200 bg-white")}>
                    <div>
                      <span className={isDone ? "line-through text-stone-400" : "font-medium text-navy-800"}>{t.title}</span>
                      <span className="ml-2 text-xs text-stone-400">para {t.assignedTo?.name ?? "disponivel"}</span>
                    </div>
                    <span className="text-xs text-stone-400">{format(t.deadline, "dd/MM/yyyy")}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-stone-400 text-sm text-center py-4">Nenhuma tarefa vinculada.</p>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="section-title">Movimentacoes ({process.movements.length})</h2>
        </div>
        {process.movements.length === 0 ? (
          <div className="px-6 py-8 text-center text-stone-400 text-sm">Nenhuma movimentacao registrada.</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {process.movements.map((m) => (
              <li key={m.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{m.description}</p>
                    {m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.attachments.map((a) => (
                          <a key={a.id} href={"/api/uploads/" + a.storedName} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-1 rounded transition">
                            <svg className="w-3 h-3 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            {a.filename}
                          </a>
                        ))}
                      </div>
                    )}
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
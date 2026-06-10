import { getServerSession } from "next-auth";
import { authOptions, isSocioOrAbove } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getDeadlineStatus, deadlineBadgeClass, deadlineBadgeText, statusBadgeClass, statusLabel } from "@/lib/utils";
import TaskActions from "@/components/TaskActions";

export const dynamic = "force-dynamic";

export default async function ConsultivoTarefaPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) notFound();

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
      process: { select: { id: true, number: true, subject: true } },
      movements: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } }, attachments: true },
      },
    },
  });

  if (!task) notFound();

  const isStaff = isSocioOrAbove(session.user);
  const isOwner = task.assignedToId === session.user.id;

  // Só acessa quem é staff, o responsável, ou se a tarefa está disponível (sem responsável)
  if (!isStaff && !isOwner && task.assignedToId !== null) notFound();

  const dlStatus = getDeadlineStatus(task.deadline.toISOString());
  const isDone = task.status === "CONCLUIDA";
  const isUnassigned = !task.assignedTo;
  const canManage = isStaff || isOwner;
  const canClaim = isUnassigned && !isStaff;

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/dashboard/consultivo" className="mt-1 text-stone-400 hover:text-navy-700 transition flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="eyebrow">Consultivo</p>
          <h1 className={`page-title mt-0.5 break-words ${isDone ? "line-through text-stone-400" : ""}`}>
            {task.title}
          </h1>
          {task.clientName && (
            <p className="text-sm text-stone-500 mt-1">
              Cliente: <span className="font-medium text-navy-700">{task.clientName}</span>
            </p>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="mb-6">
        <TaskActions
          taskId={task.id}
          status={task.status}
          isAdmin={isStaff}
          canManage={canManage}
          canClaim={canClaim}
        />
      </div>

      {/* Cards de info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Status</p>
          <span className={"px-2 py-1 rounded-full text-xs font-medium " + statusBadgeClass(task.status)}>
            {statusLabel(task.status)}
          </span>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Prazo</p>
          {!isDone ? (
            <span className={"inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium " + deadlineBadgeClass(dlStatus)}>
              {format(task.deadline, "dd/MM/yyyy")}
              <span className="opacity-70">· {deadlineBadgeText(dlStatus, task.deadline.toISOString())}</span>
            </span>
          ) : (
            <span className="text-xs text-stone-400">{format(task.deadline, "dd/MM/yyyy")}</span>
          )}
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Delegado por</p>
          <p className="text-sm text-stone-700">{task.assignedBy.name}</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Responsável</p>
          {task.assignedTo ? (
            <p className="text-sm text-stone-700">{task.assignedTo.name}</p>
          ) : (
            <span className="text-xs font-medium text-gold-700 bg-gold-50 px-2 py-1 rounded-full">Disponível</span>
          )}
        </div>

        {task.process && (
          <div className="card p-4 col-span-2">
            <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Processo vinculado</p>
            <Link href={`/dashboard/processos/${task.process.id}`} className="text-sm font-medium text-navy-700 hover:text-gold-700 hover:underline inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {task.process.number}
              {task.process.subject && <span className="text-stone-400 font-normal">— {task.process.subject}</span>}
            </Link>
          </div>
        )}
      </div>

      {/* Descrição */}
      {task.description && (
        <div className="card p-5 mb-4">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-2">Descrição</p>
          <p className="text-sm text-stone-600 whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {/* Movimentações */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="section-title">Movimentações ({task.movements.length})</h2>
        </div>
        {task.movements.length === 0 ? (
          <div className="px-6 py-8 text-center text-stone-400 text-sm">Nenhuma movimentação registrada.</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {task.movements.map((m) => (
              <li key={m.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{m.description}</p>
                    {m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={"/api/uploads/" + a.storedName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-1 rounded transition"
                          >
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

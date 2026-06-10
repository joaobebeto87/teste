import { getServerSession } from "next-auth";
import { authOptions, isSocioOrAbove, canVerPublicacoes } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { differenceInCalendarDays } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

function isTrabalhista(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  return digits.length >= 14 && digits[13] === "5";
}

function urgencyColors(tasks: { deadline: Date }[], now: Date): { border: string; chip: string; text: string } {
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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isStaff = isSocioOrAbove(session.user);
  const canPublicacoes = canVerPublicacoes(session.user);
  const now = new Date();

  if (isStaff) {
    const [rawPublicacoes, users] = await Promise.all([
      canPublicacoes
        ? prisma.process.findMany({
            where: { syncCreatedAt: { not: null } },
            select: { id: true, number: true, client: true, syncCreatedAt: true },
          })
        : Promise.resolve([] as { id: string; number: string; client: string | null; syncCreatedAt: Date | null }[]),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          tasksReceived: {
            where: { status: { not: "CONCLUIDA" } },
            select: { id: true, deadline: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const publicacoesFiltradas = canPublicacoes
      ? rawPublicacoes.filter((p) => !isTrabalhista(p.number))
      : [];
    const semMarcador = publicacoesFiltradas.filter((p) => !p.client);
    const totalPublicacoes = publicacoesFiltradas.length;

    return (
      <div className="p-8">
        <div className="mb-8">
          <p className="eyebrow mb-1">Painel de Controle</p>
          <h1 className="page-title">Bem-vindo, {session.user?.name?.split(" ")[0]}.</h1>
          <p className="text-stone-500 text-sm mt-1">{format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {canPublicacoes && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="section-title">Publicações DJEN</h2>
                    <p className="text-xs text-stone-500">Tribunais estaduais e STJ (TRT/TST filtrados)</p>
                  </div>
                </div>
                <Link href="/dashboard/publicacoes" className="text-sm font-medium text-gold-700 hover:text-gold-800 transition">
                  Ver todas →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-stone-50 p-4">
                  <p className="text-3xl font-bold tracking-tight text-navy-800 tabular-nums">{totalPublicacoes}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-stone-500 mt-1">Total importadas</p>
                </div>
                <div className={`rounded-xl p-4 ${semMarcador.length > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                  <p className={`text-3xl font-bold tracking-tight tabular-nums ${semMarcador.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {semMarcador.length}
                  </p>
                  <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${semMarcador.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {semMarcador.length > 0 ? "Precisam de classificação" : "Todas classificadas"}
                  </p>
                </div>
              </div>

              {semMarcador.length > 0 && (
                <Link
                  href="/dashboard/publicacoes"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Classificar {semMarcador.length} publicação(ões)
                </Link>
              )}
              {semMarcador.length === 0 && totalPublicacoes === 0 && (
                <p className="text-xs text-stone-400 text-center py-2">
                  Nenhuma publicação importada. Execute a sincronização DJEN.
                </p>
              )}
            </div>
          )}

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </span>
                <div>
                  <h2 className="section-title">Consultivo — Pendentes</h2>
                  <p className="text-xs text-stone-500">Tarefas em aberto por responsável</p>
                </div>
              </div>
              <Link href="/dashboard/consultivo" className="text-sm font-medium text-gold-700 hover:text-gold-800 transition">
                Ver todas →
              </Link>
            </div>

            <div className="space-y-2">
              {users.length === 0 && (
                <p className="text-sm text-stone-400 text-center py-4">Nenhum usuário cadastrado.</p>
              )}
              {users.map((u) => {
                const tasks = u.tasksReceived;
                const colors = urgencyColors(tasks as any, now);
                const hasUrgent = tasks.some((t) => differenceInCalendarDays(new Date(t.deadline), now) <= 3);
                return (
                  <Link
                    key={u.id}
                    href={`/dashboard/consultivo?assignee=${u.id}`}
                    className="flex items-center justify-between rounded-xl border px-4 py-3 transition hover:shadow-sm hover:border-stone-300"
                    style={tasks.length > 0 ? { borderColor: colors.border } : { borderColor: "#e7e5e4" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                        style={tasks.length > 0 ? { backgroundColor: colors.chip, color: colors.text } : { backgroundColor: "#f5f5f4", color: "#78716c" }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy-800">{u.name.split(" ")[0]}</p>
                        {hasUrgent && (
                          <p className="text-[0.65rem] text-red-600 font-medium">Tarefa urgente</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tasks.length > 0 ? (
                        <>
                          <span className="text-2xl font-bold tabular-nums" style={{ color: colors.text }}>{tasks.length}</span>
                          <span className="text-xs text-stone-500">pendente(s)</span>
                        </>
                      ) : (
                        <span className="text-stone-300 text-sm">sem tarefas</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Estagiário: suas tarefas pendentes
  const minhasTarefas = await prisma.task.findMany({
    where: {
      assignedToId: session.user.id,
      status: { not: "CONCLUIDA" },
    },
    select: { id: true, title: true, clientName: true, deadline: true, status: true },
    orderBy: { deadline: "asc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="eyebrow mb-1">Painel de Controle</p>
        <h1 className="page-title">Bem-vindo, {session.user?.name?.split(" ")[0]}.</h1>
        <p className="text-stone-500 text-sm mt-1">{format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      <div className="card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </span>
            <div>
              <h2 className="section-title">Minhas Tarefas</h2>
              <p className="text-xs text-stone-500">{minhasTarefas.length} tarefa(s) pendente(s)</p>
            </div>
          </div>
          <Link href="/dashboard/consultivo" className="text-sm font-medium text-gold-700 hover:text-gold-800 transition">
            Ver todas →
          </Link>
        </div>

        {minhasTarefas.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-8">Nenhuma tarefa pendente.</p>
        )}
        <div className="space-y-2">
          {minhasTarefas.map((t) => {
            const d = differenceInCalendarDays(new Date(t.deadline), now);
            const expired = d < 0;
            const urgent = d >= 0 && d <= 3;
            return (
              <Link
                key={t.id}
                href={`/dashboard/consultivo/${t.id}`}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition hover:shadow-sm ${
                  expired ? "border-red-200 bg-red-50" : urgent ? "border-amber-200 bg-amber-50" : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${expired ? "text-red-800" : "text-navy-800"}`}>{t.title}</p>
                  {t.clientName && <p className="text-xs text-stone-500 mt-0.5">{t.clientName}</p>}
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  expired ? "bg-red-100 text-red-700" : urgent ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"
                }`}>
                  {format(new Date(t.deadline), "dd/MM/yyyy")}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

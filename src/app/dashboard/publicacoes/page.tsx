import { getServerSession } from "next-auth";
import { authOptions, canVerPublicacoes } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = "force-dynamic";

// CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO — posição 13 (0-indexed) dos dígitos = segmento J
// J=5 → trabalhista (TRT/TST) — filtrado automaticamente
function isTrabalhista(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  return digits.length >= 14 && digits[13] === "5";
}

export default async function PublicacoesPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canVerPublicacoes(session.user)) redirect("/dashboard");

  const [rawPublicacoes, lastSyncRow] = await Promise.all([
    prisma.process.findMany({
      where: { syncCreatedAt: { not: null } },
      select: {
        id: true,
        number: true,
        parties: true,
        subject: true,
        client: true,
        clientName: true,
        syncCreatedAt: true,
        lastSyncMovementAt: true,
        publicacaoOabs: true,
        status: true,
      },
      orderBy: { syncCreatedAt: "desc" },
    }),
    prisma.appConfig.findUnique({ where: { key: "pje_last_sync_at" } }),
  ]);

  // Filtra trabalhistas (J=5)
  const publicacoes = rawPublicacoes.filter((p) => !isTrabalhista(p.number));

  const lastSync = lastSyncRow?.value ? new Date(lastSyncRow.value) : null;
  const lastSyncMs = lastSync?.getTime() ?? null;

  const semMarcador = publicacoes.filter((p) => !p.client);
  const comMarcador = publicacoes.filter((p) => p.client);

  function isNew(p: { syncCreatedAt: Date | null }) {
    return lastSyncMs !== null && p.syncCreatedAt !== null && p.syncCreatedAt.getTime() === lastSyncMs;
  }

  function marcadorLabel(client: string | null): { label: string; cls: string } {
    if (client === "ESCRITORIO") return { label: "Cível", cls: "bg-navy-100 text-navy-700" };
    if (client === "PREFEITURA") return { label: "Pessoal", cls: "bg-sky-100 text-sky-700" };
    return { label: "Sem marcador", cls: "bg-stone-100 text-stone-500" };
  }

  const renderRow = (p: (typeof publicacoes)[number], i: number) => {
    const novo = isNew(p);
    const rowBg = novo ? "bg-sky-50 border-l-4 border-sky-400" : i % 2 === 0 ? "bg-white" : "bg-[#f7f5ef]";
    const { label, cls } = marcadorLabel(p.client);
    return (
      <tr key={p.id} className={`border-b border-stone-100 hover:bg-stone-100 transition ${rowBg}`}>
        <td className="px-6 py-3 font-mono font-semibold text-xs">
          <div className="flex items-center gap-2">
            {novo && <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" title="Novo na última sync"></span>}
            <Link href={`/dashboard/processos/${p.id}`} className="text-navy-700 hover:text-gold-700 hover:underline">
              {p.number}
            </Link>
          </div>
        </td>
        <td className="px-6 py-3 max-w-[200px] truncate text-stone-700 text-sm">
          {p.clientName || p.parties || <span className="text-stone-400">—</span>}
        </td>
        <td className="px-6 py-3 max-w-xs truncate text-sm text-stone-600">
          {p.subject}
        </td>
        <td className="px-6 py-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
        </td>
        <td className="px-6 py-3 text-xs text-stone-500">
          {p.syncCreatedAt ? format(p.syncCreatedAt, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
        </td>
        <td className="px-6 py-3">
          <Link href={`/dashboard/processos/${p.id}`} className="text-xs font-medium text-gold-700 hover:text-gold-800 transition">
            Ver →
          </Link>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">DJEN</p>
          <h1 className="page-title">Publicações</h1>
          <p className="text-stone-500 text-sm mt-1">
            {publicacoes.length} publicação(ões) · {semMarcador.length} sem marcador
            {lastSync && (
              <> · Última sync: {format(lastSync, "dd/MM/yyyy HH:mm", { locale: ptBR })}</>
            )}
          </p>
        </div>
        <Link href="/dashboard/sincronizar-djen" className="btn-ghost text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sincronizar DJEN
        </Link>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500 mb-4">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span> Novo na última sincronização</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-stone-300 inline-block"></span> Publicações trabalhistas (TRT/TST) são filtradas automaticamente</span>
      </div>

      {/* Sem marcador — precisam de ação */}
      {semMarcador.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-200 bg-amber-50">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3l-6.93-12a2 2 0 00-3.48 0l-6.93 12a2 2 0 001.74 3z" />
            </svg>
            <h2 className="section-title text-amber-800">Não classificadas ({semMarcador.length})</h2>
            <p className="text-xs text-amber-600 ml-auto">Abra o processo e adicione o marcador Cível ou Pessoal</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                  <th className="px-6 py-3 font-medium">Nº do Processo</th>
                  <th className="px-6 py-3 font-medium">Cliente / Partes</th>
                  <th className="px-6 py-3 font-medium">Assunto</th>
                  <th className="px-6 py-3 font-medium">Marcador</th>
                  <th className="px-6 py-3 font-medium">Sync em</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>{semMarcador.map((p, i) => renderRow(p, i))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Com marcador */}
      {comMarcador.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-200">
            <h2 className="section-title">Classificadas ({comMarcador.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                  <th className="px-6 py-3 font-medium">Nº do Processo</th>
                  <th className="px-6 py-3 font-medium">Cliente / Partes</th>
                  <th className="px-6 py-3 font-medium">Assunto</th>
                  <th className="px-6 py-3 font-medium">Marcador</th>
                  <th className="px-6 py-3 font-medium">Sync em</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>{comMarcador.map((p, i) => renderRow(p, i))}</tbody>
            </table>
          </div>
        </div>
      )}

      {publicacoes.length === 0 && (
        <div className="card p-12 text-center text-stone-400">
          Nenhuma publicação DJEN encontrada. Execute a sincronização para importar.
        </div>
      )}
    </div>
  );
}

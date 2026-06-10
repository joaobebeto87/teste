export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { MONITORED_OABS } from "@/lib/djen";

function formatBR(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { timeZone: "America/Recife" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

interface PerOab { oab: string; label: string; total: number; }
interface LastResult {
  at: string; found: number; synced: number; created: number;
  skipped: number; remaining: number; perOab: PerOab[]; errors: string[];
}

export default async function SincronizarDjenPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [row, lastSyncRow] = await Promise.all([
    prisma.appConfig.findUnique({ where: { key: "djen_last_result" } }),
    prisma.appConfig.findUnique({ where: { key: "pje_last_sync_at" } }),
  ]);
  let last: LastResult | null = null;
  try { last = row?.value ? (JSON.parse(row.value) as LastResult) : null; } catch { last = null; }
  const lastSyncAt = lastSyncRow?.value ?? last?.at ?? null;

  return (
    <div className="p-8 max-w-3xl">
      <p className="eyebrow">Administração</p>
      <h1 className="page-title mt-1">Sincronizar Publicações (DJEN)</h1>
      <p className="mt-3 text-sm text-stone-500">
        O sistema importa as publicações do{" "}
        <strong className="text-stone-700">Diário de Justiça Eletrônico Nacional</strong> (CNJ) pelas
        OABs monitoradas, cria movimentações nos processos e cadastra os que ainda não existem
        (capa e andamentos complementados pelo <strong className="text-stone-700">Datajud</strong>).
      </p>

      <div className="mt-6 card">
        <h2 className="section-title mb-3">OABs monitoradas</h2>
        <ul className="text-sm text-stone-600 space-y-1">
          {MONITORED_OABS.map((o) => (
            <li key={o.numero}>• <strong>{o.numero}/PE</strong> — {o.label}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 card">
        <h2 className="section-title mb-2">Última sincronização</h2>
        {lastSyncAt && (
          <p className="text-sm text-stone-500 mb-4">{formatBR(lastSyncAt)}</p>
        )}
        {last ? (
          <>
            {!lastSyncAt && <p className="text-sm text-stone-500 mb-4">{formatBR(last.at)}</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat label="Publicações novas"  value={last.found}     color="text-stone-700" />
              <Stat label="Processos criados"  value={last.created}   color="text-blue-600" />
              <Stat label="Movimentações"      value={last.synced}    color="text-green-700" />
              <Stat label="Já processadas"     value={last.skipped}   color="text-stone-500" />
              <Stat label="Restantes"          value={last.remaining} color="text-amber-600" />
            </div>
            {last.perOab?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-stone-400 mb-1">Publicações encontradas por OAB</p>
                <ul className="text-sm text-stone-600 space-y-0.5">
                  {last.perOab.map((o) => (
                    <li key={o.oab}><span className="font-mono">{o.oab}</span> — {o.label}: <strong>{o.total}</strong></li>
                  ))}
                </ul>
              </div>
            )}
            {last.errors?.length > 0 && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm font-semibold text-red-700 mb-1">Avisos:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {last.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-500">
            Nenhuma sincronização registrada ainda. Rode o script local para a primeira carga.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
        <h2 className="font-semibold text-stone-700 mb-2">Como a sincronização roda</h2>
        <p className="mb-3">
          A API do CNJ bloqueia consultas de fora do Brasil, e o servidor de produção tem IP nos EUA.
          Por isso a busca roda <strong>no seu computador</strong> (IP brasileiro): um script consulta
          o DJEN e envia as publicações para o sistema gravar.
        </p>
        <p className="mb-1 font-medium text-stone-700">Rodar manualmente (no seu PC):</p>
        <div className="rounded bg-navy-800 text-gold-400 font-mono text-xs p-3 mb-3">
          <p>node scripts/sync-djen-local.mjs</p>
        </div>
        <p className="text-xs text-stone-500">
          Requer as variáveis <code className="font-mono">GP_BASE_URL</code> e{" "}
          <code className="font-mono">GP_CRON_SECRET</code>. Recomendado agendar
          como Tarefa do Windows para rodar automaticamente.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-white p-3 border border-stone-100">
      <p className="text-stone-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-bold text-2xl ${color}`}>{value}</p>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

function formatBR(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { timeZone: "America/Recife" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

interface LastResult {
  at: string;
  processes: number;
  movements: number;
  errors: string[];
}

export default async function SincronizarDatajudPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [row, totalRow] = await Promise.all([
    prisma.appConfig.findUnique({ where: { key: "datajud_last_result" } }),
    prisma.process.count({ where: { type: "JUDICIAL", status: { not: "ARQUIVADO" } } }),
  ]);
  let last: LastResult | null = null;
  try { last = row?.value ? (JSON.parse(row.value) as LastResult) : null; } catch { last = null; }

  return (
    <div className="p-8 max-w-3xl">
      <p className="eyebrow">Administração</p>
      <h1 className="page-title mt-1">Sincronizar Andamentos (Datajud)</h1>
      <p className="mt-3 text-sm text-stone-500">
        O sistema consulta o <strong className="text-stone-700">Datajud (CNJ)</strong> para todos os
        processos judiciais ativos e registra automaticamente os andamentos novos como movimentações,
        evitando a necessidade de acompanhamento manual de cada processo.
      </p>

      {/* Aviso */}
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium mb-1">⚠ Execução local obrigatória</p>
        <p className="text-xs text-amber-700">
          A API do Datajud bloqueia IPs de fora do Brasil. Por isso a sincronização precisa rodar no
          computador do escritório, usando o script local descrito abaixo.
        </p>
      </div>

      {/* Stats */}
      <div className="mt-4 card">
        <h2 className="section-title mb-3">Situação atual</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Processos judiciais ativos" value={totalRow} color="text-navy-700" />
          {last && (
            <>
              <Stat label="Últ. processos atualizados" value={last.processes} color="text-green-700" />
              <Stat label="Andamentos registrados"    value={last.movements}  color="text-blue-600" />
            </>
          )}
        </div>
      </div>

      {/* Último resultado */}
      <div className="mt-4 card">
        <h2 className="section-title mb-2">Última sincronização</h2>
        {last ? (
          <>
            <p className="text-sm text-stone-500 mb-4">{formatBR(last.at)}</p>
            {last.errors?.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm font-semibold text-red-700 mb-1">Avisos ({last.errors.length}):</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {last.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-500">Nenhuma sincronização registrada ainda.</p>
        )}
      </div>

      {/* Como rodar */}
      <div className="mt-4 card p-5">
        <h2 className="font-semibold text-stone-700 mb-3">Executar sincronização agora</h2>
        <p className="text-sm text-stone-500 mb-3">
          Abra um terminal no computador do escritório, na pasta do projeto, e execute:
        </p>
        <div className="rounded bg-navy-800 text-gold-400 font-mono text-xs p-3 mb-1 select-all">
          node scripts/sync-datajud-local.mjs --base https://processos.cpaadvogados.com.br --secret SEU_CRON_SECRET
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Substitua <code>SEU_CRON_SECRET</code> pelo valor da variável <code>CRON_SECRET</code> no Vercel.
        </p>
      </div>

      {/* Automação */}
      <div className="mt-4 card p-5">
        <h2 className="font-semibold text-stone-700 mb-3">Automação (tarefa diária às 09:30)</h2>
        <p className="text-sm text-stone-500 mb-3">
          Para automatizar, execute o comando abaixo{" "}
          <strong>uma única vez como Administrador</strong> no computador do escritório:
        </p>
        <div className="rounded bg-navy-800 text-gold-400 font-mono text-xs p-3 mb-3 select-all">
          powershell -ExecutionPolicy Bypass -File &quot;C:\projetos\monitor-juridico\scripts\instalar-tarefa-datajud.ps1&quot; -CronSecret &quot;SEU_CRON_SECRET&quot;
        </div>
        <p className="text-xs text-stone-400">
          A tarefa{" "}<code>CPA-SyncDatajud</code>{" "}será criada no Windows Task Scheduler e rodará
          automaticamente às 09:30, meia hora depois do sync do DJEN. O log fica em{" "}
          <code>%TEMP%\cpa-sync-datajud.log</code>.
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

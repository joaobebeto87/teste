"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BackupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [retention, setRetention] = useState(14);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OneDrive (Microsoft Graph)
  const [msConfigured, setMsConfigured] = useState(false);
  const [msAuthorized, setMsAuthorized] = useState<boolean | null>(null);
  const [msFolder, setMsFolder] = useState("");
  const [msSyncing, setMsSyncing] = useState(false);
  const [msResult, setMsResult] = useState<{ uploaded: number; skipped: number; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      if (res.ok) {
        setBackups(data.backups);
        setRetention(data.retention);
      } else {
        setError(data.error ?? "Erro ao carregar backups");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMsStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/microsoft/status");
      const data = await res.json();
      if (res.ok) {
        setMsConfigured(data.configured);
        setMsAuthorized(data.authorized);
        setMsFolder(data.folder);
      }
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      load();
      loadMsStatus();
    }
  }, [status, load, loadMsStatus]);

  async function handleSyncOneDrive() {
    setMsSyncing(true);
    setError(null);
    setMsResult(null);
    try {
      const res = await fetch("/api/cron/backup-anexos-onedrive", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Erro ao sincronizar anexos");
      else setMsResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMsSyncing(false);
    }
  }

  if (status === "loading") return null;
  if (session?.user?.role !== "ADMIN") {
    router.replace("/dashboard");
    return null;
  }

  async function handleBackup() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Erro ao gerar backup");
      else await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <p className="eyebrow">Administração</p>
      <h1 className="page-title mt-1">Backup do Sistema</h1>
      <p className="mt-3 text-sm text-stone-500">
        Gera uma cópia completa do banco de dados (processos, movimentações,
        tarefas, usuários e configurações). Os {retention} backups mais recentes
        são mantidos; os mais antigos são removidos automaticamente.
      </p>

      <div className="mt-6 card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title mb-1">Gerar backup agora</h2>
            <p className="text-sm text-stone-500">
              Cria uma nova cópia imediatamente. Baixe o arquivo e guarde fora do
              servidor (ex.: OneDrive) para proteção contra perda total.
            </p>
          </div>
          <button
            onClick={handleBackup}
            disabled={creating}
            className="btn-primary shrink-0 disabled:opacity-50"
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Gerando…
              </span>
            ) : (
              "Fazer backup agora"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Erro:</strong> {error}
        </div>
      )}

      <div className="mt-6 card overflow-hidden">
        <div className="px-6 pt-4 pb-2 border-b border-stone-100">
          <h2 className="section-title">Backups disponíveis</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {loading ? "Carregando…" : `${backups.length} backup(s)`}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
              <th className="px-6 py-3 font-medium">Data</th>
              <th className="px-6 py-3 font-medium">Arquivo</th>
              <th className="px-6 py-3 font-medium">Tamanho</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {!loading && backups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-stone-400">
                  Nenhum backup gerado ainda.
                </td>
              </tr>
            )}
            {backups.map((b, i) => (
              <tr key={b.filename} className={`border-b border-stone-100 ${i % 2 === 0 ? "bg-white" : "bg-[#f7f5ef]"}`}>
                <td className="px-6 py-3 text-stone-700">{formatDate(b.createdAt)}</td>
                <td className="px-6 py-3 font-mono text-xs text-stone-500">{b.filename}</td>
                <td className="px-6 py-3 text-stone-600">{formatSize(b.size)}</td>
                <td className="px-6 py-3">
                  <a
                    href={`/api/backup/download?file=${encodeURIComponent(b.filename)}`}
                    className="font-medium text-gold-700 transition hover:text-gold-800"
                  >
                    Baixar ↓
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
        <h2 className="font-semibold text-stone-700 mb-2">Agendamento automático (Dokploy)</h2>
        <p className="mb-3">Configure um cron job para backup diário automático:</p>
        <div className="rounded bg-stone-800 text-green-400 font-mono text-xs p-3 space-y-1">
          <p>Método: POST</p>
          <p>URL: {"{NEXTAUTH_URL}"}/api/cron/backup</p>
          <p>Header: x-cron-secret: {"{CRON_SECRET}"}</p>
        </div>
      </div>

      {/* Anexos no OneDrive via Microsoft Graph (automático, na VPS).
          Só aparece quando a integração tem credenciais configuradas. */}
      {msConfigured && (
      <div className="mt-6 card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title mb-1">Anexos no OneDrive (automático)</h2>
            <p className="text-sm text-stone-500">
              Envia os anexos (PDFs/Word) direto para o seu OneDrive na nuvem, em
              pastas por número de processo (<code>{msFolder || "Gestao Processos/Anexos"}/&lt;nº&gt;</code>).
              Roda na própria VPS — não depende do seu computador ligado.
            </p>
          </div>
          {msAuthorized === true ? (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Conectado
            </span>
          ) : msAuthorized === false ? (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-stone-200 px-3 py-1 text-xs font-medium text-stone-600">
              Não conectado
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/microsoft/auth" className="btn-ghost">
            {msAuthorized ? "Reconectar OneDrive" : "Conectar OneDrive"}
          </a>
          <button
            onClick={handleSyncOneDrive}
            disabled={msSyncing || !msAuthorized}
            className="btn-primary disabled:opacity-50"
          >
            {msSyncing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Sincronizando…
              </span>
            ) : (
              "Sincronizar anexos agora"
            )}
          </button>
        </div>

        {msResult && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
            <p className="text-green-800">
              <strong>{msResult.uploaded}</strong> novo(s) enviado(s),{" "}
              <strong>{msResult.skipped}</strong> já existente(s)
              {msResult.errors.length > 0 && (
                <>, <strong className="text-red-700">{msResult.errors.length}</strong> erro(s)</>
              )}
              .
            </p>
            {msResult.errors.length > 0 && (
              <ul className="mt-2 text-xs text-red-600 space-y-1">
                {msResult.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500">
          <p className="font-medium text-stone-600 mb-1">Agendamento automático (Dokploy)</p>
          <div className="rounded bg-stone-800 text-green-400 font-mono p-3 space-y-1">
            <p>Método: POST</p>
            <p>URL: {"{NEXTAUTH_URL}"}/api/cron/backup-anexos-onedrive</p>
            <p>Header: x-cron-secret: {"{CRON_SECRET}"}</p>
          </div>
        </div>
      </div>
      )}

      <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
        <h2 className="font-semibold text-stone-700 mb-2">
          {msConfigured
            ? "Alternativa: script local (sem Azure)"
            : "Anexos off-site no OneDrive (pastas por processo)"}
        </h2>
        <p className="mb-3">
          {msConfigured ? "Em vez da integração automática acima, dá para copiar os " : "Os "}
          <strong>anexos</strong> (PDFs/Word) são copiados para o seu OneDrive, organizados em
          pastas por número de processo, pelo script{" "}
          <code className="text-stone-700">scripts/backup-anexos.ps1</code> rodando no seu
          computador (Agendador de Tarefas do Windows):
        </p>
        <div className="rounded bg-stone-800 text-green-400 font-mono text-xs p-3 space-y-1">
          <p>{"$env:GP_BASE_URL = \"{NEXTAUTH_URL}\""}</p>
          <p>{"$env:GP_CRON_SECRET = \"{CRON_SECRET}\""}</p>
          <p>powershell -File scripts\backup-anexos.ps1</p>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Destino padrão: <code>OneDrive\Backups\Anexos Processos\&lt;nº&gt;\</code>. É incremental
          e nunca apaga arquivos locais.
        </p>
      </div>
    </div>
  );
}

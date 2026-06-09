"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface SyncResult {
  found: number;
  synced: number;
  created: number;
  skipped: number;
  errors: string[];
}

export default function SincronizarPjePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") return null;
  if (session?.user?.role !== "ADMIN") {
    router.replace("/dashboard");
    return null;
  }

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/cron/sincronizar-pje", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Erro desconhecido");
      else setResult(data as SyncResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <p className="eyebrow">Administração</p>
      <h1 className="page-title mt-1">Sincronizar PJe Push</h1>
      <p className="mt-3 text-sm text-stone-500">
        Lê os e-mails do marcador{" "}
        <strong className="text-stone-700">
          "Trabalho/Atualizações de Processos"
        </strong>{" "}
        no Gmail e sincroniza os processos judiciais: cria movimentações nos
        processos já cadastrados e cadastra automaticamente os que ainda não
        existem no sistema.
      </p>

      {/* Google auth */}
      <div className="mt-6 card">
        <h2 className="section-title mb-2">Autorização Google</h2>
        <p className="text-sm text-stone-500 mb-4">
          A sincronização requer acesso de leitura ao Gmail. Após esta
          atualização, você precisa re-autorizar o Google uma vez para incluir
          esse escopo.
        </p>
        <a href="/api/google/auth" className="btn-primary inline-block">
          Autorizar / Re-autorizar Google
        </a>
      </div>

      {/* Manual sync */}
      <div className="mt-4 card">
        <h2 className="section-title mb-2">Sincronização Manual</h2>
        <p className="text-sm text-stone-500 mb-4">
          Processa os e-mails do marcador agora. Mensagens já processadas
          anteriormente são ignoradas automaticamente.
        </p>
        <button
          onClick={handleSync}
          disabled={loading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Sincronizando…
            </span>
          ) : (
            "Sincronizar agora"
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-5">
          <h2 className="font-semibold text-green-800 mb-4">
            Resultado da sincronização
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-white p-3 border border-green-100">
              <p className="text-stone-400 text-xs uppercase tracking-wide mb-1">
                E-mails encontrados
              </p>
              <p className="font-bold text-2xl text-stone-700">{result.found}</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-green-100">
              <p className="text-stone-400 text-xs uppercase tracking-wide mb-1">
                Movimentações registradas
              </p>
              <p className="font-bold text-2xl text-green-700">{result.synced}</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-green-100">
              <p className="text-stone-400 text-xs uppercase tracking-wide mb-1">
                Processos criados automaticamente
              </p>
              <p className="font-bold text-2xl text-blue-600">{result.created}</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-green-100">
              <p className="text-stone-400 text-xs uppercase tracking-wide mb-1">
                Já processados (pulados)
              </p>
              <p className="font-bold text-2xl text-stone-500">{result.skipped}</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm font-semibold text-red-700 mb-1">Erros:</p>
              <ul className="text-xs text-red-600 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {/* Scheduling info */}
      <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
        <h2 className="font-semibold text-stone-700 mb-2">
          Agendamento automático (EasyPanel)
        </h2>
        <p className="mb-3">
          Configure um cron job no EasyPanel para execução diária automática:
        </p>
        <div className="rounded bg-stone-800 text-green-400 font-mono text-xs p-3 space-y-1">
          <p>Método: POST</p>
          <p>URL: {"{NEXTAUTH_URL}"}/api/cron/sincronizar-pje</p>
          <p>Header: x-cron-secret: {"{CRON_SECRET}"}</p>
        </div>
      </div>
    </div>
  );
}

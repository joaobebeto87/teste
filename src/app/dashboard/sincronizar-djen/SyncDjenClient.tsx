"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncDjenClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ found: number; synced: number; created: number; errors?: string[] } | null>(null);
  const [error, setError] = useState("");

  async function runSync() {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/cron/sincronizar-djen", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }
      setResult(data);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Falha na requisição");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 mb-2">
      <button
        onClick={runSync}
        disabled={loading}
        className="flex items-center gap-2 bg-navy-700 hover:bg-navy-800 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Sincronizando...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sincronizar agora
          </>
        )}
      </button>

      {error && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium text-amber-800 mb-1">Sincronização pelo servidor indisponível</p>
          <p className="text-xs text-amber-700">{error}</p>
          <p className="text-xs text-amber-700 mt-2">
            A API do CNJ bloqueia IPs de fora do Brasil. Use o script local (ver instruções abaixo).
          </p>
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-medium">Sincronização concluída</p>
          <p className="text-xs mt-1">
            {result.found} novas · {result.created} processos criados · {result.synced} movimentações
          </p>
          {result.errors && result.errors.length > 0 && (
            <p className="text-xs mt-1 text-amber-700">{result.errors.length} aviso(s)</p>
          )}
        </div>
      )}
    </div>
  );
}

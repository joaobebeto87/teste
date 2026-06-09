"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AuditLog {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: string | null;
  createdAt: string;
}

const ACTION_BADGE: Record<string, string> = {
  CRIAR: "bg-emerald-100 text-emerald-700",
  EDITAR: "bg-navy-100 text-navy-700",
  ARQUIVAR: "bg-stone-200 text-stone-600",
  DESARQUIVAR: "bg-amber-100 text-amber-800",
  EXCLUIR: "bg-red-100 text-red-700",
  BACKUP: "bg-gold-100 text-gold-700",
};

function actionLabel(a: string): string {
  const map: Record<string, string> = {
    CRIAR: "Criou",
    EDITAR: "Editou",
    ARQUIVAR: "Arquivou",
    DESARQUIVAR: "Desarquivou",
    EXCLUIR: "Excluiu",
    BACKUP: "Backup",
  };
  return map[a] ?? a;
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

const PAGE = 100;

export default function AuditoriaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ take: String(PAGE) });
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    try {
      const res = await fetch(`/api/auditoria?${params}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [action, entityType]);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  if (status === "loading") return null;
  if (session?.user?.role !== "ADMIN") {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="p-8">
      <p className="eyebrow mb-1">Administração</p>
      <h1 className="page-title">Trilha de Auditoria</h1>
      <p className="text-stone-500 text-sm mt-1">
        Registro de ações sensíveis no sistema. {total} evento(s) registrado(s).
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <select value={action} onChange={(e) => setAction(e.target.value)} className="input max-w-[200px]">
          <option value="">Todas as ações</option>
          <option value="CRIAR">Criação</option>
          <option value="EDITAR">Edição</option>
          <option value="ARQUIVAR">Arquivamento</option>
          <option value="DESARQUIVAR">Desarquivamento</option>
          <option value="EXCLUIR">Exclusão</option>
          <option value="BACKUP">Backup</option>
        </select>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="input max-w-[200px]">
          <option value="">Todos os tipos</option>
          <option value="Processo">Processo</option>
          <option value="Usuario">Usuário</option>
          <option value="Backup">Backup</option>
        </select>
      </div>

      <div className="mt-4 card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                <th className="px-6 py-3 font-medium">Data/Hora</th>
                <th className="px-6 py-3 font-medium">Usuário</th>
                <th className="px-6 py-3 font-medium">Ação</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-stone-400">Carregando…</td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-stone-400">Nenhum evento registrado.</td></tr>
              )}
              {!loading && logs.map((l, i) => (
                <tr key={l.id} className={`border-b border-stone-100 ${i % 2 === 0 ? "bg-white" : "bg-[#f7f5ef]"}`}>
                  <td className="px-6 py-3 text-stone-500 text-xs whitespace-nowrap">{formatDate(l.createdAt)}</td>
                  <td className="px-6 py-3 text-stone-700">{l.userName}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACTION_BADGE[l.action] ?? "bg-stone-100 text-stone-600"}`}>
                      {actionLabel(l.action)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-stone-600">{l.entityType}</td>
                  <td className="px-6 py-3 text-stone-700">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && total > PAGE && (
        <p className="mt-3 text-xs text-stone-400">
          Mostrando os {PAGE} eventos mais recentes de {total}.
        </p>
      )}
    </div>
  );
}

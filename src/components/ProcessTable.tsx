"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  getDeadlineStatus, deadlineRowClass, deadlineCellClass,
  deadlineBadgeClass, deadlineBadgeText, statusBadgeClass, statusLabel,
} from "@/lib/utils";

export interface ProcessRow {
  id: string;
  number: string;
  type?: string | null;
  client?: string | null;
  parties?: string | null;
  category?: string | null;
  subject?: string;
  createdByName?: string;
  status?: string;
  lastMovementAt?: string | null;
  deadline?: string | null;
  archivedAt?: string | null;
  isNewFromSync?: boolean;
  hasRecentSyncMovement?: boolean;
}

export type ProcessColumnKey =
  | "marcador" | "number" | "tipo" | "parties" | "subject"
  | "createdByName" | "category" | "status" | "lastMovementAt" | "deadline" | "archivedAt";

const COLUMN_LABELS: Record<ProcessColumnKey, string> = {
  marcador: "Marcador",
  number: "Nº do Processo",
  tipo: "Tipo",
  parties: "Partes",
  subject: "Assunto",
  createdByName: "Cadastrado por",
  category: "Categoria",
  status: "Status",
  lastMovementAt: "Última Movimentação",
  deadline: "Prazo Fatal",
  archivedAt: "Arquivado em",
};

const DATE_KEYS: ProcessColumnKey[] = ["lastMovementAt", "deadline", "archivedAt"];

function clientLabel(client?: string | null): string {
  if (client === "ESCRITORIO") return "Cível";
  if (client === "PREFEITURA") return "Pessoal";
  return "";
}

function typeLabel(type?: string | null): string {
  if (type === "JUDICIAL") return "Judicial";
  if (type === "ADMINISTRATIVO") return "Administrativo";
  return type ?? "";
}

// Valor usado para ordenar cada coluna (null/"" sempre por último).
function sortValue(row: ProcessRow, key: ProcessColumnKey): string | null {
  switch (key) {
    case "marcador":
      return clientLabel(row.client) || null;
    case "tipo":
      return typeLabel(row.type) || null;
    case "status":
      return row.status ? statusLabel(row.status) : null;
    case "number":
      return row.number ?? null;
    case "parties":
      return row.parties ?? null;
    case "subject":
      return row.subject ?? null;
    case "createdByName":
      return row.createdByName ?? null;
    case "category":
      return row.category ?? null;
    case "lastMovementAt":
      return row.lastMovementAt ?? null;
    case "deadline":
      return row.deadline ?? null;
    case "archivedAt":
      return row.archivedAt ?? null;
  }
}

export default function ProcessTable({
  rows,
  columns,
  columnLabels,
  deadlineColoring = true,
  syncHighlight = false,
  emptyLabel = "Nenhum processo cadastrado.",
}: {
  rows: ProcessRow[];
  columns: ProcessColumnKey[];
  columnLabels?: Partial<Record<ProcessColumnKey, string>>;
  deadlineColoring?: boolean;
  syncHighlight?: boolean;
  emptyLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<ProcessColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: ProcessColumnKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      // valores vazios sempre por último, independente da direção
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (DATE_KEYS.includes(sortKey)) {
        cmp = new Date(av).getTime() - new Date(bv).getTime();
      } else {
        cmp = av.localeCompare(bv, "pt-BR", { numeric: true });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
            {columns.map((col) => {
              const active = sortKey === col;
              return (
                <th key={col} className="px-6 py-3 font-medium">
                  <button
                    onClick={() => toggleSort(col)}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-navy-700 ${active ? "text-navy-700" : ""}`}
                  >
                    {(columnLabels && columnLabels[col]) ?? COLUMN_LABELS[col]}
                    <span className="text-[0.6rem] leading-none">
                      {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
            <th className="px-6 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-stone-400">
                {emptyLabel}
              </td>
            </tr>
          )}
          {sorted.map((p, i) => {
            const status = getDeadlineStatus(deadlineColoring ? p.deadline : null);
            const zebraClass = status !== "expired" ? (i % 2 === 0 ? "bg-white" : "bg-[#f7f5ef]") : "";
            // Precedência da linha: prazo expirado (vermelho) > novo na sync (azul) >
            // movimentado na sync (verde) > zebra padrão.
            const rowBg =
              status === "expired"
                ? deadlineRowClass(status)
                : syncHighlight && p.isNewFromSync
                ? "bg-sky-50 border-l-4 border-sky-400"
                : syncHighlight && p.hasRecentSyncMovement
                ? "bg-emerald-50 border-l-4 border-emerald-400"
                : zebraClass;
            const cellClass = deadlineCellClass(status);
            return (
              <tr key={p.id} className={`border-b border-stone-100 hover:bg-stone-100 transition ${rowBg}`}>
                {columns.map((col) => {
                  switch (col) {
                    case "marcador":
                      return (
                        <td key={col} className="px-6 py-3">
                          {p.client === "ESCRITORIO" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-navy-700">
                              <span className="w-2.5 h-2.5 rounded-full bg-navy-700 flex-shrink-0"></span>
                              Cível
                            </span>
                          ) : p.client === "PREFEITURA" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-sky-700">
                              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 flex-shrink-0"></span>
                              Pessoal
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs">—</span>
                          )}
                        </td>
                      );
                    case "number":
                      return (
                        <td key={col} className={`px-6 py-3 font-mono font-semibold ${cellClass}`}>
                          <Link href={`/dashboard/processos/${p.id}`} className="text-navy-700 transition hover:text-gold-700 hover:underline">
                            {p.number}
                          </Link>
                        </td>
                      );
                    case "tipo":
                      return (
                        <td key={col} className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.type === "JUDICIAL" ? "bg-navy-100 text-navy-700" : "bg-stone-100 text-stone-600"}`}>
                            {typeLabel(p.type)}
                          </span>
                        </td>
                      );
                    case "parties":
                      return (
                        <td key={col} className={`px-6 py-3 max-w-xs truncate ${cellClass}`}>
                          {p.parties || <span className="text-stone-400">—</span>}
                        </td>
                      );
                    case "subject":
                      return (
                        <td key={col} className={`px-6 py-3 max-w-xs truncate ${cellClass}`}>{p.subject}</td>
                      );
                    case "createdByName":
                      return <td key={col} className="px-6 py-3 text-stone-600">{p.createdByName}</td>;
                    case "category":
                      return <td key={col} className="px-6 py-3 text-stone-600">{(p as any).category || <span className="text-stone-400">—</span>}</td>;
                    case "status":
                      return (
                        <td key={col} className="px-6 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(p.status ?? "")}`}>
                            {statusLabel(p.status ?? "")}
                          </span>
                        </td>
                      );
                    case "lastMovementAt":
                      return (
                        <td key={col} className="px-6 py-3 text-stone-500 text-xs">
                          {p.lastMovementAt ? format(new Date(p.lastMovementAt), "dd/MM/yyyy HH:mm") : "—"}
                        </td>
                      );
                    case "deadline":
                      return (
                        <td key={col} className="px-6 py-3">
                          {p.deadline ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${deadlineBadgeClass(status)}`}>
                              {format(new Date(p.deadline), "dd/MM/yyyy")}
                              <span className="opacity-70">· {deadlineBadgeText(status, p.deadline)}</span>
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs">—</span>
                          )}
                        </td>
                      );
                    case "archivedAt":
                      return (
                        <td key={col} className="px-6 py-3 text-stone-500 text-xs">
                          {p.archivedAt ? format(new Date(p.archivedAt), "dd/MM/yyyy") : "—"}
                        </td>
                      );
                  }
                })}
                <td className="px-6 py-3">
                  <Link href={`/dashboard/processos/${p.id}`} className="font-medium text-gold-700 transition hover:text-gold-800">
                    Ver →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

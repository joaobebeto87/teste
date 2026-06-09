import { Prisma } from "@prisma/client";
import { format } from "date-fns";

export interface ReportFilters {
  de?: string;     // data inicial (createdAt >=) — yyyy-MM-dd
  ate?: string;    // data final (createdAt <=)   — yyyy-MM-dd
  tipo?: string;   // ADMINISTRATIVO | JUDICIAL
  status?: string; // ATIVO | CONCLUIDO | ARQUIVADO
}

/** Constrói o filtro Prisma a partir dos parâmetros do relatório. */
export function buildProcessWhere(f: ReportFilters): Prisma.ProcessWhereInput {
  const where: Prisma.ProcessWhereInput = {};

  if (f.tipo === "ADMINISTRATIVO" || f.tipo === "JUDICIAL") {
    where.type = f.tipo;
  }
  if (f.status === "ATIVO" || f.status === "CONCLUIDO" || f.status === "ARQUIVADO") {
    where.status = f.status;
  }
  if (f.de || f.ate) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (f.de) createdAt.gte = new Date(`${f.de}T00:00:00`);
    if (f.ate) createdAt.lte = new Date(`${f.ate}T23:59:59`);
    where.createdAt = createdAt;
  }

  return where;
}

export interface ReportRow {
  number: string;
  type: string;
  subject: string;
  status: string;
  client: string | null;
  parties: string | null;
  createdByName: string;
  createdAt: Date;
  deadline: Date | null;
}

const TYPE_LABEL: Record<string, string> = {
  ADMINISTRATIVO: "Administrativo",
  JUDICIAL: "Judicial",
};
const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Ativo",
  CONCLUIDO: "Concluído",
  ARQUIVADO: "Arquivado",
};
const CLIENT_LABEL: Record<string, string> = {
  ESCRITORIO: "Escritório",
  PREFEITURA: "Prefeitura",
};

function csvCell(value: string): string {
  // Escapa aspas e envolve sempre em aspas (lida com ; , quebras de linha)
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Gera o conteúdo CSV (separador ";", compatível com Excel pt-BR).
 * Inclui BOM UTF-8 para acentuação correta ao abrir no Excel.
 */
export function rowsToCsv(rows: ReportRow[]): string {
  const header = [
    "Nº Processo", "Tipo", "Assunto", "Status", "Cliente",
    "Partes", "Cadastrado por", "Criado em", "Prazo fatal",
  ];
  const lines = [header.map(csvCell).join(";")];

  for (const r of rows) {
    lines.push([
      r.number,
      TYPE_LABEL[r.type] ?? r.type,
      r.subject,
      STATUS_LABEL[r.status] ?? r.status,
      r.client ? CLIENT_LABEL[r.client] ?? r.client : "",
      r.parties ?? "",
      r.createdByName,
      format(new Date(r.createdAt), "dd/MM/yyyy HH:mm"),
      r.deadline ? format(new Date(r.deadline), "dd/MM/yyyy") : "",
    ].map((v) => csvCell(String(v))).join(";"));
  }

  return "﻿" + lines.join("\r\n");
}

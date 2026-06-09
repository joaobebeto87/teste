import { differenceInCalendarDays } from "date-fns";

export type DeadlineStatus = "normal" | "warning" | "danger" | "expired";

export function getDeadlineStatus(deadline: Date | string | null | undefined): DeadlineStatus {
  if (!deadline) return "normal";
  const diff = differenceInCalendarDays(new Date(deadline), new Date());
  if (diff < 0) return "expired";
  if (diff < 3) return "danger";
  if (diff === 3) return "warning";
  return "normal";
}

export function deadlineRowClass(status: DeadlineStatus): string {
  if (status === "expired") return "bg-red-100 border-l-4 border-red-600";
  return "";
}

export function deadlineCellClass(status: DeadlineStatus): string {
  if (status === "expired") return "font-bold text-red-900";
  if (status === "danger") return "text-red-700 font-semibold";
  if (status === "warning") return "text-amber-700 font-semibold";
  return "text-stone-700";
}

export function deadlineBadgeClass(status: DeadlineStatus): string {
  if (status === "expired") return "bg-red-200 text-red-900 font-bold";
  if (status === "danger") return "bg-red-100 text-red-700";
  if (status === "warning") return "bg-amber-100 text-amber-800";
  return "bg-emerald-50 text-emerald-700";
}

export function deadlineBadgeText(status: DeadlineStatus, deadline: Date | string | null | undefined): string {
  if (!deadline) return "Sem prazo";
  const diff = differenceInCalendarDays(new Date(deadline), new Date());
  if (status === "expired") return `Expirado ha ${Math.abs(diff)}d`;
  if (diff === 0) return "Hoje!";
  if (diff === 1) return "Amanha!";
  return `${diff} dias`;
}

export function generateProcessNumber(year: number, sequence: number): string {
  return `${String(sequence).padStart(4, "0")}/${year}`;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ATIVO: "Ativo",
    CONCLUIDO: "Concluido",
    ARQUIVADO: "Arquivado",
    PENDENTE: "Pendente",
    EM_ANDAMENTO: "Em andamento",
    CONCLUIDA: "Concluida",
  };
  return map[status] ?? status;
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    ATIVO: "bg-navy-100 text-navy-700",
    CONCLUIDO: "bg-emerald-100 text-emerald-700",
    ARQUIVADO: "bg-stone-100 text-stone-600",
    PENDENTE: "bg-amber-100 text-amber-800",
    EM_ANDAMENTO: "bg-navy-100 text-navy-700",
    CONCLUIDA: "bg-emerald-100 text-emerald-700",
  };
  return map[status] ?? "bg-stone-100 text-stone-600";
}
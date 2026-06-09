import { prisma } from "./db";

export type AuditAction =
  | "CRIAR"
  | "EDITAR"
  | "ARQUIVAR"
  | "DESARQUIVAR"
  | "EXCLUIR"
  | "BACKUP";

export type AuditEntity = "Processo" | "Usuario" | "Backup";

interface AuditActor {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}

interface LogAuditInput {
  actor: AuditActor;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Registra uma entrada na trilha de auditoria.
 * Best-effort: nunca lança — uma falha de auditoria jamais deve quebrar a ação
 * principal do usuário. Erros são apenas logados no console.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.actor?.id ?? null,
        userName: input.actor?.name || input.actor?.email || "Sistema",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (err) {
    console.error("Falha ao registrar auditoria:", err);
  }
}

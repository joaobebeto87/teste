import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isSocioOrAbove, canExcluirProcesso } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { deleteUploadFiles } from "@/lib/uploads";
import {
  createDeadlineEvent,
  updateDeadlineEvent,
  deleteCalendarEvent,
} from "@/lib/googleCalendar";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const process = await prisma.process.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      movements: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          attachments: true,
        },
      },
      tasks: {
        include: {
          assignedTo: { select: { name: true } },
          assignedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      hearings: {
        orderBy: { dateTime: "asc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!process) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
  return NextResponse.json(process);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const process = await prisma.process.findUnique({ where: { id: params.id } });
  if (!process) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const body = await req.json();
  const isStaff = isSocioOrAbove(session.user);

  // clientName pode ser alterado por qualquer usuário autenticado
  const data: Record<string, unknown> = {};

  if ("clientName" in body) data.clientName = body.clientName || null;

  // campos restritos a ADMIN/SOCIO
  if (isStaff) {
    if ("subject" in body && body.subject?.trim()) data.subject = body.subject.trim();
    if ("description" in body) data.description = body.description || null;
    if ("parties" in body) data.parties = body.parties || null;
    if ("deadline" in body) data.deadline = body.deadline ? new Date(body.deadline) : null;
    if ("status" in body) data.status = body.status;
    if ("client" in body) data.client = body.client || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const updated = await prisma.process.update({ where: { id: params.id }, data });

  // ── Google Calendar: sincronizar evento de prazo ───────────────────────────
  if (isStaff && "deadline" in body) {
    const newDeadline = updated.deadline;
    const oldEventId = process.googleEventId;

    if (newDeadline) {
      if (oldEventId) {
        // Atualizar evento existente
        await updateDeadlineEvent(oldEventId, {
          number: process.number,
          subject: updated.subject,
          deadline: newDeadline,
        });
      } else {
        // Criar novo evento
        const eventId = await createDeadlineEvent({
          number: process.number,
          subject: updated.subject,
          deadline: newDeadline,
        });
        if (eventId) {
          await prisma.process.update({
            where: { id: params.id },
            data: { googleEventId: eventId },
          });
        }
      }
    } else if (oldEventId) {
      // Prazo removido → apagar evento
      await deleteCalendarEvent(oldEventId);
      await prisma.process.update({
        where: { id: params.id },
        data: { googleEventId: null },
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  await logAudit({
    actor: session.user,
    action: "EDITAR",
    entityType: "Processo",
    entityId: params.id,
    summary: `Editou o processo ${process.number}`,
    metadata: { fields: Object.keys(data) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canExcluirProcesso(session.user)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const process = await prisma.process.findUnique({
    where: { id: params.id },
    include: {
      movements: { include: { attachments: true } },
    },
  });
  if (!process) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
  // process.googleEventId está disponível pois o campo está no modelo

  // Remove arquivos físicos antes de deletar do banco
  const storedNames = process.movements.flatMap((m) => m.attachments.map((a) => a.storedName));
  await deleteUploadFiles(storedNames);

  // Remove evento de prazo no Google Calendar, se existir
  if (process.googleEventId) {
    await deleteCalendarEvent(process.googleEventId);
  }

  await prisma.process.delete({ where: { id: params.id } });

  await logAudit({
    actor: session.user,
    action: "EXCLUIR",
    entityType: "Processo",
    entityId: params.id,
    summary: `Excluiu o processo ${process.number}: ${process.subject}`,
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isSocioOrAbove } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
      process: { select: { id: true, number: true, subject: true } },
      movements: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          attachments: true,
        },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const isStaff = isSocioOrAbove(session.user);
  const isOwner = task.assignedToId === session.user.id;

  if (!isStaff && !isOwner) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  return NextResponse.json(task);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { id: true, assignedToId: true, status: true },
  });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const isStaff = isSocioOrAbove(session.user);
  const isOwner = task.assignedToId === session.user.id;

  const body = await req.json();

  // Reivindicar tarefa sem responsável
  if (body.claim === true) {
    if (task.assignedToId) {
      return NextResponse.json({ error: "Tarefa já tem responsável" }, { status: 409 });
    }
    const updated = await prisma.task.update({
      where: { id: params.id },
      data: { assignedToId: session.user.id, read: true },
    });
    return NextResponse.json(updated);
  }

  // Atualização de status — próprio dono ou staff
  if ("status" in body && Object.keys(body).length === 1) {
    if (!isStaff && !isOwner) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const updated = await prisma.task.update({
      where: { id: params.id },
      data: { status: body.status },
    });
    return NextResponse.json(updated);
  }

  // Edição completa — só staff
  if (!isStaff) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if ("title" in body && body.title?.trim()) data.title = body.title.trim();
  if ("description" in body) data.description = body.description || null;
  if ("clientName" in body) data.clientName = body.clientName || null;
  if ("assignedToId" in body) data.assignedToId = body.assignedToId || null;
  if ("processId" in body) data.processId = body.processId || null;
  if ("deadline" in body && body.deadline) data.deadline = new Date(body.deadline);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const updated = await prisma.task.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isSocioOrAbove(session.user)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const task = await prisma.task.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

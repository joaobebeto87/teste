import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canJudicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateProcessNumber } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const processes = await prisma.process.findMany({
    include: { createdBy: { select: { name: true, email: true } }, movements: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(processes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const body = await req.json();
  const { subject, parties, description, deadline } = body;
  const type = body.type === "JUDICIAL" ? "JUDICIAL" : "ADMINISTRATIVO";
  const category = (body.category as string | null)?.trim() || null;

  if (!subject) {
    return NextResponse.json({ error: "Assunto e obrigatorio" }, { status: 400 });
  }

  const year = new Date().getFullYear();

  // ----- Processo JUDICIAL: numero informado manualmente, sem contador -----
  if (type === "JUDICIAL") {
    if (!canJudicial(session.user)) {
      return NextResponse.json({ error: "Acesso negado: requer nivel 2." }, { status: 403 });
    }
    const number = (body.number as string | null)?.trim();
    if (!number) {
      return NextResponse.json({ error: "Informe o numero do processo judicial." }, { status: 400 });
    }
    const VALID_CLIENTS = ["ESCRITORIO", "PREFEITURA"];
    const client = VALID_CLIENTS.includes(body.client) ? body.client : null;
    try {
      const process = await prisma.process.create({
        data: {
          number,
          subject,
          parties: parties || null,
          description: description || null,
          deadline: deadline ? new Date(deadline) : null,
          type: "JUDICIAL",
          client,
          year,
          sequence: 0,
          createdById: session.user.id,
        },
        include: { createdBy: { select: { name: true, email: true } } },
      });
      await logAudit({
        actor: session.user,
        action: "CRIAR",
        entityType: "Processo",
        entityId: process.id,
        summary: `Criou o processo judicial ${process.number}: ${process.subject}`,
        metadata: { type: "JUDICIAL", client },
      });
      return NextResponse.json(process, { status: 201 });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "Ja existe um processo com este numero." }, { status: 409 });
      }
      throw e;
    }
  }

  // ----- Processo ADMINISTRATIVO: numero automatico via contador permanente -----
  const process = await prisma.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { year },
      create: { year, lastSeq: 1 },
      update: { lastSeq: { increment: 1 } },
    });
    const sequence = counter.lastSeq;
    const number = generateProcessNumber(year, sequence);

    return tx.process.create({
      data: {
        number,
        subject,
        description: description || null,
        category,
        deadline: deadline ? new Date(deadline) : null,
        type: "ADMINISTRATIVO",
        year,
        sequence,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { name: true, email: true } } },
    });
  });

  await logAudit({
    actor: session.user,
    action: "CRIAR",
    entityType: "Processo",
    entityId: process.id,
    summary: `Criou o processo administrativo ${process.number}: ${process.subject}`,
    metadata: { type: "ADMINISTRATIVO", category },
  });

  return NextResponse.json(process, { status: 201 });
}
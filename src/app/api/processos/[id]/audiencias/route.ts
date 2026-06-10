import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const hearings = await prisma.hearing.findMany({
    where: { processId: params.id },
    orderBy: { dateTime: "asc" },
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(hearings);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const process = await prisma.process.findUnique({ where: { id: params.id }, select: { id: true, number: true, subject: true } });
  if (!process) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const body = await req.json();
  const { type, title, dateTime, location, description } = body;

  if (!title?.trim() || !dateTime) {
    return NextResponse.json({ error: "Título e data/hora são obrigatórios" }, { status: 400 });
  }

  const VALID_TYPES = ["AUDIENCIA", "REUNIAO", "PRAZO", "DILIGENCIA", "OUTRO"];
  const hearingType = VALID_TYPES.includes(type) ? type : "OUTRO";

  const hearing = await prisma.hearing.create({
    data: {
      processId: params.id,
      type: hearingType,
      title: title.trim(),
      description: description?.trim() || null,
      location: location?.trim() || null,
      dateTime: new Date(dateTime),
      createdById: session.user.id,
    },
    include: { createdBy: { select: { name: true } } },
  });

  // Google Calendar: não implementado ainda
  return NextResponse.json({ ...hearing, googleEventCreated: false }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; hearingId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const hearing = await prisma.hearing.findUnique({
    where: { id: params.hearingId },
    select: { id: true, processId: true, createdById: true, googleEventId: true },
  });

  if (!hearing) return NextResponse.json({ error: "Compromisso não encontrado" }, { status: 404 });
  if (hearing.processId !== params.id) return NextResponse.json({ error: "Compromisso não pertence a este processo" }, { status: 400 });

  const canDelete = isAdmin(session.user) || hearing.createdById === session.user.id;
  if (!canDelete) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  await prisma.hearing.delete({ where: { id: params.hearingId } });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PUT /api/usuarios/[id] — altera o perfil (role) do usuário
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Você não pode alterar seu próprio perfil." }, { status: 400 });
  }

  const body = await req.json();
  const VALID_ROLES = ["ADMIN", "SOCIO", "ESTAGIARIO"];
  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { role: body.role },
    select: { id: true, name: true, role: true },
  });

  return NextResponse.json(user);
}

// DELETE /api/usuarios/[id] — exclui o usuário
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Você não pode excluir sua própria conta." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, accessLevel: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { name, email, password, role, accessLevel } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });

  const finalRole = role === "ADMIN" ? "ADMIN" : "ASSESSOR";
  const lvl = Number(accessLevel) === 2 ? 2 : 1;

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hash, role: finalRole, accessLevel: lvl },
    select: { id: true, name: true, email: true, role: true, accessLevel: true, createdAt: true },
  });
  await logAudit({
    actor: session.user,
    action: "CRIAR",
    entityType: "Usuario",
    entityId: user.id,
    summary: `Criou o usuário ${user.name} (${user.email})`,
    metadata: { role: user.role, accessLevel: user.accessLevel },
  });
  return NextResponse.json(user, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Recebe uma lista de CNJ digits e retorna quais já existem no banco.
// Usado pelo script local de sync para saber quais processos são novos
// (e só então buscar capas no DataJud — evitando lookups desnecessários).
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const cnjs: string[] = Array.isArray(body?.cnjs) ? body.cnjs : [];

  if (cnjs.length === 0) return NextResponse.json({ existing: [] });

  // Busca apenas os números necessários — compara por dígitos sem formatação
  const processes = await prisma.process.findMany({
    select: { number: true },
    where: { type: "JUDICIAL" },
  });

  const existingDigits = new Set(
    processes.map((p) => p.number.replace(/\D/g, "")).filter((d) => d.length === 20)
  );

  const existing = cnjs.filter((c) => existingDigits.has(c.replace(/\D/g, "")));

  return NextResponse.json({ existing });
}

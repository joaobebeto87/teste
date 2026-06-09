import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildProcessWhere, rowsToCsv, ReportRow } from "@/lib/reports";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const where = buildProcessWhere({
    de: sp.get("de") ?? undefined,
    ate: sp.get("ate") ?? undefined,
    tipo: sp.get("tipo") ?? undefined,
    status: sp.get("status") ?? undefined,
  });

  const processes = await prisma.process.findMany({
    where,
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows: ReportRow[] = processes.map((p) => ({
    number: p.number,
    type: p.type,
    subject: p.subject,
    status: p.status,
    client: p.client,
    parties: p.parties,
    createdByName: p.createdBy.name,
    createdAt: p.createdAt,
    deadline: p.deadline,
  }));

  const csv = rowsToCsv(rows);
  const filename = `relatorio-processos-${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

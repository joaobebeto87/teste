import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const LAST_RESULT_KEY = "datajud_last_result";
const STATES_KEY = "datajud_movement_states";

interface IngestMovement {
  data: string; // ISO date
  nome: string;
}

interface IngestItem {
  processId: string;
  processNumber: string;
  movements: IngestMovement[]; // somente os novos (já filtrados pelo script)
  latestDate: string; // data do movimento mais recente encontrado
}

// POST — recebe andamentos novos do Datajud coletados pelo script local
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { items: IngestItem[]; adminId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const items: IngestItem[] = Array.isArray(body?.items) ? body.items : [];
  const runAt = new Date();

  // Busca o usuário ADMIN para associar as movimentações
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) return NextResponse.json({ error: "Nenhum ADMIN encontrado" }, { status: 500 });

  // Carrega estado atual
  const statesRow = await prisma.appConfig.findUnique({ where: { key: STATES_KEY } });
  let states: Record<string, string> = {};
  try { states = statesRow?.value ? JSON.parse(statesRow.value) : {}; } catch { states = {}; }

  let totalMovements = 0;
  let totalProcesses = 0;
  const errors: string[] = [];

  for (const item of items) {
    if (!item.processId || !Array.isArray(item.movements) || item.movements.length === 0) continue;
    try {
      // Cria uma movimentação consolidada com todos os andamentos novos
      const linhas = item.movements.map((m) => {
        const d = m.data ? m.data.substring(0, 10) : "";
        return `• ${d} — ${m.nome}`;
      });
      const description = [
        "[Andamento automático — Datajud]",
        "",
        ...linhas,
      ].join("\n");

      await prisma.movement.create({
        data: {
          processId: item.processId,
          description,
          userId: admin.id,
        },
      });

      // Atualiza lastSyncMovementAt do processo
      await prisma.process.update({
        where: { id: item.processId },
        data: { lastSyncMovementAt: runAt },
      });

      // Atualiza estado (data do movimento mais recente)
      if (item.latestDate) {
        states[item.processId] = item.latestDate;
      }

      totalMovements += item.movements.length;
      totalProcesses++;
    } catch (err: any) {
      errors.push(`${item.processNumber}: ${err?.message ?? String(err)}`);
    }
  }

  // Persiste estados atualizados
  await prisma.appConfig.upsert({
    where: { key: STATES_KEY },
    update: { value: JSON.stringify(states) },
    create: { key: STATES_KEY, value: JSON.stringify(states) },
  });

  const summary = {
    at: runAt.toISOString(),
    processes: totalProcesses,
    movements: totalMovements,
    errors,
  };
  await prisma.appConfig.upsert({
    where: { key: LAST_RESULT_KEY },
    update: { value: JSON.stringify(summary) },
    create: { key: LAST_RESULT_KEY, value: JSON.stringify(summary) },
  });

  return NextResponse.json(summary, { status: 201 });
}

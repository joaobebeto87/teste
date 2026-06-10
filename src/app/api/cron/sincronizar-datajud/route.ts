import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const LAST_RESULT_KEY = "datajud_last_result";
const STATES_KEY = "datajud_movement_states";

// GET — retorna processos judiciais ativos + estado atual de andamentos
// Usado pelo script local para saber o que sincronizar
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [processes, statesRow, lastResultRow] = await Promise.all([
    prisma.process.findMany({
      where: { type: "JUDICIAL", status: { not: "ARQUIVADO" } },
      select: { id: true, number: true },
    }),
    prisma.appConfig.findUnique({ where: { key: STATES_KEY } }),
    prisma.appConfig.findUnique({ where: { key: LAST_RESULT_KEY } }),
  ]);

  let states: Record<string, string> = {};
  try { states = statesRow?.value ? JSON.parse(statesRow.value) : {}; } catch { states = {}; }

  let lastResult = null;
  try { lastResult = lastResultRow?.value ? JSON.parse(lastResultRow.value) : null; } catch { lastResult = null; }

  return NextResponse.json({ processes, states, lastResult });
}

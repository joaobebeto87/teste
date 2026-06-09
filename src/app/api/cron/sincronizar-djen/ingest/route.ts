import { NextRequest, NextResponse } from "next/server";
import { ingestDjen } from "@/lib/djen";

// Recebe as publicações (e capas do Datajud) já coletadas por um cliente de IP
// brasileiro — necessário porque a API do CNJ bloqueia o IP (EUA) da VPS.
// Corpo: { items: DjenItem[], perOab: [...], capas: { [cnjDigits]: DatajudCapa|null } }
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items) {
    return NextResponse.json({ error: "Campo 'items' ausente ou inválido" }, { status: 400 });
  }
  const perOab = Array.isArray(body?.perOab) ? body.perOab : [];
  const capas = body?.capas && typeof body.capas === "object" ? body.capas : {};

  try {
    const result = await ingestDjen(items, perOab, capas);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Erro ao ingerir DJEN:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

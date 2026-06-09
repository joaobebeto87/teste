import { NextResponse } from "next/server";

// DESATIVADO: a sincronização por e-mail do Gmail (PJe Push) foi substituída pela
// sincronização oficial via DJEN (/api/cron/sincronizar-djen/ingest, alimentada
// pelo script local). Este endpoint vira um no-op para evitar movimentações
// duplicadas caso algum cron antigo ainda o dispare. O código em
// src/lib/gmail-pje.ts permanece no repositório apenas para referência.
export async function POST() {
  return NextResponse.json({
    disabled: true,
    message:
      "Sincronização por Gmail (PJe Push) desativada — substituída pela sincronização DJEN.",
  });
}

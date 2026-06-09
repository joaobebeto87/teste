import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAndSyncDjen } from "@/lib/djen";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  const isAuthorizedByCron = secret === process.env.CRON_SECRET;

  if (!isAuthorizedByCron) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const result = await fetchAndSyncDjen({ dryRun });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Erro ao sincronizar DJEN:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

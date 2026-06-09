import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createBackup } from "@/lib/backup";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  const isAuthorizedByCron = secret === process.env.CRON_SECRET;

  let actorName = "Cron automático";
  let actorId: string | null = null;

  if (!isAuthorizedByCron) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    actorName = session.user.name ?? session.user.email ?? "Administrador";
    actorId = session.user.id;
  }

  try {
    const backup = await createBackup();
    await logAudit({
      actor: { id: actorId, name: actorName },
      action: "BACKUP",
      entityType: "Backup",
      entityId: backup.filename,
      summary: isAuthorizedByCron
        ? `Backup automático gerado (${backup.filename})`
        : `Backup manual gerado (${backup.filename})`,
      metadata: { size: backup.size },
    });
    return NextResponse.json(backup);
  } catch (err: any) {
    console.error("Erro ao gerar backup:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

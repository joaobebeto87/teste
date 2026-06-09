import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveBackupFile } from "@/lib/backup";
import { promises as fs } from "fs";

export async function GET(req: NextRequest) {
  // Aceita a chave de cron (para o script de backup automático no PC) OU
  // uma sessão de admin (download manual pela página de Backup).
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
  }

  const name = req.nextUrl.searchParams.get("file") ?? "";
  const filePath = resolveBackupFile(name);
  if (!filePath) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(data.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup não encontrado" }, { status: 404 });
  }
}

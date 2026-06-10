import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isSocioOrAbove } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { UPLOAD_DIR } from "@/lib/uploads";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { id: true, assignedToId: true },
  });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const isStaff = isSocioOrAbove(session.user);
  const isOwner = task.assignedToId === session.user.id;
  if (!isStaff && !isOwner) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const form = await req.formData();
  const description = (form.get("description") as string | null)?.trim();
  const notifyEmail = (form.get("notifyEmail") as string | null)?.trim() || null;

  if (!description) return NextResponse.json({ error: "Descrição é obrigatória" }, { status: 400 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  for (const file of files) {
    const name = file.name.toLowerCase();
    const isAllowed =
      file.type === "application/pdf" ||
      file.type === DOCX_MIME ||
      file.type === "image/jpeg" ||
      name.endsWith(".pdf") ||
      name.endsWith(".docx") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg");
    if (!isAllowed) return NextResponse.json({ error: `"${file.name}" não é um PDF, Word ou JPEG.` }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `"${file.name}" excede 15 MB.` }, { status: 400 });
  }

  const saved: { filename: string; storedName: string; mimeType: string; size: number }[] = [];
  if (files.length > 0) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name).toLowerCase() || ".bin";
      const storedName = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`;
      await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
      saved.push({ filename: file.name, storedName, mimeType: file.type || "application/octet-stream", size: file.size });
    }
  }

  const movement = await prisma.taskMovement.create({
    data: {
      taskId: params.id,
      description,
      notifyEmail,
      userId: session.user.id,
      ...(saved.length > 0 && { attachments: { create: saved } }),
    },
    include: { user: { select: { name: true } }, attachments: true },
  });

  return NextResponse.json(movement, { status: 201 });
}

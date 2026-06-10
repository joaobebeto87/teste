import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isSocioOrAbove } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendTaskAssignedEmail, sendTaskAvailableEmail } from "@/lib/email";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { UPLOAD_DIR } from "@/lib/uploads";
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true" && session.user.role === "ADMIN";

  const tasks = await prisma.task.findMany({
    where: all ? {} : { assignedToId: session.user.id },
    include: {
      assignedTo: { select: { name: true, email: true } },
      assignedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isSocioOrAbove(session.user)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const form = await req.formData();
  const title = (form.get("title") as string | null)?.trim();
  const description = (form.get("description") as string | null)?.trim() || null;
  const clientName = (form.get("clientName") as string | null)?.trim() || null;
  const assignedToId = (form.get("assignedToId") as string | null)?.trim() || null;
  const processId = (form.get("processId") as string | null)?.trim() || null;
  const deadline = form.get("deadline") as string | null;
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!title || !deadline) {
    return NextResponse.json({ error: "Título e prazo são obrigatórios" }, { status: 400 });
  }

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
    if (!isAllowed) return NextResponse.json({ error: `O arquivo "${file.name}" não é um PDF, Word ou JPEG.` }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `O arquivo "${file.name}" excede 15 MB.` }, { status: 400 });
  }

  let assignee: { email: string; name: string } | null = null;
  if (assignedToId) {
    assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { email: true, name: true } });
    if (!assignee) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  if (processId) {
    const proc = await prisma.process.findUnique({ where: { id: processId }, select: { id: true } });
    if (!proc) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
  }

  const saved: { filename: string; storedName: string; mimeType: string; size: number; fullPath: string }[] = [];
  if (files.length > 0) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name).toLowerCase() || ".pdf";
      const storedName = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`;
      await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
      saved.push({ filename: file.name, storedName, mimeType: file.type || "application/pdf", size: file.size, fullPath: path.join(UPLOAD_DIR, storedName) });
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      clientName,
      assignedToId,
      processId,
      assignedById: session.user.id,
      deadline: new Date(deadline),
      ...(saved.length > 0 && {
        movements: {
          create: {
            description: "Tarefa delegada com documento(s) anexo(s).",
            userId: session.user.id,
            attachments: { create: saved.map((s) => ({ filename: s.filename, storedName: s.storedName, mimeType: s.mimeType, size: s.size })) },
          },
        },
      }),
    },
    include: {
      assignedTo: { select: { name: true, email: true } },
      assignedBy: { select: { name: true } },
      process: { select: { number: true, subject: true } },
    },
  });

  if (assignee) {
    sendTaskAssignedEmail({
      to: assignee.email,
      toName: assignee.name,
      fromName: session.user.name ?? "Administrador",
      taskTitle: title,
      taskDescription: description,
      deadline: new Date(deadline),
      attachments: saved.map((s) => ({ filename: s.filename, path: s.fullPath })),
    }).catch(console.error);
  } else {
    // tarefa sem responsável: avisa todos os assessores para reivindicarem
    const estagiarios = await prisma.user.findMany({ where: { role: "ESTAGIARIO" }, select: { email: true } });
    sendTaskAvailableEmail({
      to: estagiarios.map((a) => a.email).filter(Boolean),
      fromName: session.user.name ?? "Administrador",
      taskTitle: title,
      taskDescription: description,
      deadline: new Date(deadline),
    }).catch(console.error);
  }

  return NextResponse.json(task, { status: 201 });
}

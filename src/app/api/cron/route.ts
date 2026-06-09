import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { differenceInCalendarDays } from "date-fns";
import { sendDeadlineWarningEmail, sendTaskDeadlineEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const allUsers = await prisma.user.findMany({ select: { email: true } });
  const allEmails = allUsers.map((u) => u.email);

  const activeProcesses = await prisma.process.findMany({
    where: { status: "ATIVO", deadline: { not: null } },
  });

  let processNotified = 0;
  for (const p of activeProcesses) {
    if (!p.deadline) continue;
    const diff = differenceInCalendarDays(new Date(p.deadline), now);
    if (diff === 3 || diff === 0 || diff < 0) {
      await sendDeadlineWarningEmail({
        to: allEmails,
        processNumber: p.number,
        processSubject: p.subject,
        deadline: p.deadline,
        daysLeft: diff,
      }).catch(console.error);
      processNotified++;
    }
  }

  const pendingTasks = await prisma.task.findMany({
    where: { status: { not: "CONCLUIDA" } },
    include: { assignedTo: { select: { email: true, name: true } } },
  });
  const adminUsers = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  const adminEmails = adminUsers.map((u) => u.email).filter(Boolean);

  let taskNotified = 0;
  for (const t of pendingTasks) {
    const diff = differenceInCalendarDays(new Date(t.deadline), now);
    if (diff === 3 || diff === 0 || diff < 0) {
      if (t.assignedTo) {
        await sendTaskDeadlineEmail({
          to: t.assignedTo.email,
          toName: t.assignedTo.name,
          taskTitle: t.title,
          deadline: t.deadline,
          daysLeft: diff,
        }).catch(console.error);
        taskNotified++;
      } else if (adminEmails.length) {
        // tarefa sem responsável: avisa os administradores
        await sendTaskDeadlineEmail({
          to: adminEmails.join(", "),
          toName: "Administração",
          taskTitle: `${t.title} (sem responsável)`,
          deadline: t.deadline,
          daysLeft: diff,
        }).catch(console.error);
        taskNotified++;
      }
    }
  }

  return NextResponse.json({ processNotified, taskNotified });
}

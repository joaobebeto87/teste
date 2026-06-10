import { getServerSession } from "next-auth";
import { authOptions, isSocioOrAbove } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import InboxClient from "@/components/InboxClient";

export default async function ConsultivoPage({
  searchParams,
}: {
  searchParams: { assignee?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const isStaff = isSocioOrAbove(session.user);

  const [rawTasks, users, processes] = await Promise.all([
    prisma.task.findMany({
      where: isStaff
        ? {}
        : {
            OR: [
              { assignedToId: session.user.id },
              { assignedToId: null, status: { not: "CONCLUIDA" } },
            ],
          },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { name: true } },
        process: { select: { id: true, number: true } },
      },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
    }),
    isStaff
      ? prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [],
    isStaff
      ? prisma.process.findMany({
          where: { status: { not: "ARQUIVADO" } },
          select: { id: true, number: true, subject: true },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  const tasks = rawTasks.map((t) => ({
    ...t,
    clientName: (t as any).clientName ?? null,
    deadline: t.deadline.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div className="p-8">
      <InboxClient
        tasks={tasks}
        users={users}
        processes={processes}
        isStaff={isStaff}
        currentUserId={session.user.id}
        initialAssignee={searchParams?.assignee ?? ""}
      />
    </div>
  );
}

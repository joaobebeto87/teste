import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import InboxClient from "@/components/InboxClient";

export default async function CaixaEntradaPage({
  searchParams,
}: {
  searchParams: { assignee?: string };
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  const [rawTasks, users, processes] = await Promise.all([
    prisma.task.findMany({
      where: isAdmin
        ? {}
        : {
            OR: [
              { assignedToId: session!.user.id },
              { assignedToId: null, status: { not: "CONCLUIDA" } }, // disponíveis para reivindicar
            ],
          },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { name: true } },
        process: { select: { id: true, number: true } },
      },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
    }),
    isAdmin ? prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    isAdmin
      ? prisma.process.findMany({ select: { id: true, number: true, subject: true }, orderBy: { createdAt: "desc" } })
      : [],
  ]);

  const tasks = rawTasks.map((t) => ({
    ...t,
    deadline: t.deadline.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div className="p-8">
      <InboxClient tasks={tasks} users={users} processes={processes} isAdmin={isAdmin} currentUserId={session!.user.id} initialAssignee={searchParams?.assignee ?? ""} />
    </div>
  );
}

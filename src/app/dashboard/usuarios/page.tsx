import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import UsersClient from "@/components/UsersClient";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const rawUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  const users = rawUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return (
    <div className="p-8">
      <UsersClient users={users} currentUserId={session.user.id} />
    </div>
  );
}

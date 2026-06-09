import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME || "Administrador";
  const email = process.env.ADMIN_EMAIL || "admin@prefeitura.gov.br";
  const password = process.env.ADMIN_PASSWORD || "Admin@123";

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password: hash, role: "ADMIN" },
    create: { name, email, password: hash, role: "ADMIN" },
  });

  console.log(`✓ Administrador definido: ${user.name} <${user.email}>`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

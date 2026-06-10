import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

// ADMIN e SOCIO têm acesso completo (exceto área admin)
// ESTAGIARIO tem acesso restrito
export function isAdmin(user?: { role?: string } | null): boolean {
  return user?.role === "ADMIN";
}

export function isSocioOrAbove(user?: { role?: string } | null): boolean {
  return user?.role === "ADMIN" || user?.role === "SOCIO";
}

export function canJudicial(user?: { role?: string } | null): boolean {
  return !!user?.role; // todos os perfis podem ver processos judiciais
}

export function canDelegarTarefa(user?: { role?: string } | null): boolean {
  return user?.role === "ADMIN" || user?.role === "SOCIO";
}

export function canExcluirProcesso(user?: { role?: string } | null): boolean {
  return user?.role === "ADMIN" || user?.role === "SOCIO";
}

export function canVerPublicacoes(user?: { role?: string } | null): boolean {
  return user?.role === "ADMIN" || user?.role === "SOCIO";
}

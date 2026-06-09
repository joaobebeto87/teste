"use client";

import { SessionProvider as NextSessionProvider } from "next-auth/react";
import { Session } from "next-auth";

export function SessionProvider({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return <NextSessionProvider session={session}>{children}</NextSessionProvider>;
}

'use client';

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Mock session for development if needed, but for now we just wrap with SessionProvider
  return <SessionProvider session={null}>{children}</SessionProvider>;
}

import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { AppProviders } from "@/components/session/session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      {/* The shell reads the pathname; on dynamic routes (/employees/[id]) that streams in at request time. */}
      <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </AppProviders>
  );
}

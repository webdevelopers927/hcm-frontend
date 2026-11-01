"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { getMe, logout } from "@/lib/api/employees";
import type { Permission, User } from "@/lib/api/types";

type Session = { user: User | null; loading: boolean; can: (p: Permission) => boolean; signOut: () => Promise<void> };

const SessionContext = createContext<Session | null>(null);

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Auth and permission errors won't fix themselves on retry.
        retry: (count, err) => !(err instanceof ApiError && [401, 403, 404, 422].includes(err.status)) && count < 2,
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  return (
    <QueryClientProvider client={client}>
      <SessionGate>{children}</SessionGate>
    </QueryClientProvider>
  );
}

function SessionGate({ children }: { children: ReactNode }) {
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: ({ signal }) => getMe(signal), staleTime: 5 * 60_000 });
  const user = me.data ?? null;
  const value: Session = {
    user,
    loading: me.isPending,
    can: (p) => !!user?.permissions.includes(p),
    signOut: async () => {
      await logout();
      // Full reload on purpose: drops every cached query from the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <AppProviders>");
  return ctx;
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  CACHE_DEFAULT_STALE_MS,
  CACHE_GC_TIME_MS,
} from "@/lib/dash/query/cache-policy";
import { attachQueryFetchDiagnostics } from "@/lib/dash/query/dev-diagnostics";
import {
  createAccountDisabledHandler,
  registerAccountDisabledHandler,
} from "@/lib/dash/api/account-disabled";
import { clearAuthenticatedQueryCache } from "@/lib/dash/query/query-keys";
import {
  getIdTokenClaims,
  signOutPortal,
} from "@/lib/auth/firebase-client";
import { prepareDriverProofLogout } from "@/lib/dash/driver-store";
import { ACCOUNT_DISABLED_CODE } from "@/lib/auth/account-status";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_DEFAULT_STALE_MS,
        gcTime: CACHE_GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === ACCOUNT_DISABLED_CODE
          ) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    const handler = createAccountDisabledHandler({
      queryClient,
      clearAuthenticatedQueryCache,
      getDriverIdClaims: async () => {
        const claims = await getIdTokenClaims("driver");
        return claims?.driverId;
      },
      prepareDriverProofLogout,
      signOutPortal,
      setLoginMessage: (message) => {
        try {
          sessionStorage.setItem("qre-auth-disabled-message", message);
        } catch {
          // ignore storage failures
        }
      },
    });
    registerAccountDisabledHandler(handler);
    return () => {
      registerAccountDisabledHandler(null);
    };
  }, [queryClient]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    return attachQueryFetchDiagnostics(queryClient);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export { makeQueryClient };

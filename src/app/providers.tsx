"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ActionDialogs } from "@/components/shared/action-dialogs";
import { ApiError } from "@/lib/api/types";
import { useAuthStore } from "@/store/auth-store";
import { usePathname, useRouter } from "next/navigation";

function AuthBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  useEffect(() => {
    const isPublic = ["/login", "/register", "/auth"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (status === "anonymous" && !isPublic) {
      const next = encodeURIComponent(`${pathname}${window.location.search}`);
      router.replace(`/login?next=${next}`);
    }
  }, [pathname, router, status]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) =>
              error instanceof ApiError && (error.status === 0 || error.status === 429)
                ? false
                : failureCount < 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      <TooltipProvider delayDuration={200}>
        {children}
        <ActionDialogs />
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

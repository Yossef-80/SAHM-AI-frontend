"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav, TopBar } from "./mobile-nav";

/**
 * The auth routes render bare — a sidebar full of links the user cannot follow
 * yet is worse than no sidebar. This is the one place the shell knows about
 * routing, which is why it is a client component: `usePathname` cannot run on
 * the server.
 */
const BARE_ROUTES = ["/login", "/register", "/auth"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return <div className="min-h-screen">{children}</div>;
  }
  return (
    <div className="min-h-screen">
      <Sidebar />
      <TopBar />
      <main className="pb-20 md:ms-60 md:pb-0">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}

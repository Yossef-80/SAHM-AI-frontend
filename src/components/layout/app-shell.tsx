"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav, TopBar } from "./mobile-nav";
import { LanguageSwitcher } from "./language-switcher";

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
      <div className="flex min-h-screen flex-col md:ms-60">
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b bg-background/95 px-8 backdrop-blur md:flex">
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact={false} />
          </div>
        </header>
        <main className="flex-1 pb-20 md:pb-8">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

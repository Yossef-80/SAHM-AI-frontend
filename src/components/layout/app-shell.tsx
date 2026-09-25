import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { BottomNav, TopBar } from "./mobile-nav";

export function AppShell({ children }: { children: ReactNode }) {
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

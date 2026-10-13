"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { SahmIcon, SahmWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { mobileNav, isActivePath } from "./nav-config";
import { SidebarContent } from "./sidebar";
import { LanguageSwitcher } from "./language-switcher";

export function TopBar() {
  const t = useTranslations();
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("nav.openMenu")}>
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="start" className="w-64 p-0">
          <SheetTitle className="sr-only">{t("nav.openMenu")}</SheetTitle>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
        <SahmIcon variant="gradient" className="h-5 w-5 shrink-0" aria-hidden />
        <SahmWordmark className="text-sm" />
      </Link>
      <LanguageSwitcher compact />
    </header>
  );
}

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background md:hidden" aria-label="Mobile">
      {mobileNav.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-primary" : "text-muted-foreground")}
          >
            <item.icon className="h-5 w-5" />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

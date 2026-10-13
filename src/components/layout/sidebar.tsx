"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SahmIcon, SahmWordmark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { primaryNav, secondaryNav, isActivePath, type NavItem } from "./nav-config";
import { LanguageSwitcher } from "./language-switcher";
import { PortfolioSwitcher } from "./portfolio-switcher";
import { UserMenu } from "./user-menu";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {t(item.key)}
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 px-4 py-5">
        <SahmIcon variant="gradient" className="h-8 w-8 shrink-0" aria-hidden />
        <span className="flex flex-col leading-none">
          <SahmWordmark className="text-base" />
          <span className="mt-0.5 text-[10px] font-bold text-brand-pink">Marketing OS</span>
        </span>
      </Link>
      <PortfolioSwitcher />
      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
        <div className="my-3 border-t" />
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="space-y-1 border-t p-3">
        <UserMenu />
        <LanguageSwitcher />
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 border-e bg-card md:block">
      <SidebarContent />
    </aside>
  );
}

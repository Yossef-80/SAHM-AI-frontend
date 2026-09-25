import { Bot, CalendarDays, Home, MessageSquare, Megaphone, Image as ImageIcon, Lightbulb, Plug, Search, Settings, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  key: "home" | "assistant" | "research" | "campaigns" | "calendar" | "creatives" | "insights" | "agents" | "integrations" | "settings";
  icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/assistant", key: "assistant", icon: MessageSquare },
  { href: "/research", key: "research", icon: Search },
  { href: "/campaigns", key: "campaigns", icon: Megaphone },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/creatives", key: "creatives", icon: ImageIcon },
  { href: "/insights", key: "insights", icon: Lightbulb },
];

export const secondaryNav: NavItem[] = [
  { href: "/agents", key: "agents", icon: Bot },
  { href: "/integrations", key: "integrations", icon: Plug },
  { href: "/settings", key: "settings", icon: Settings },
];

/** Bottom bar on mobile keeps 5 items; the rest are reachable from the sheet menu / home. */
export const mobileNav: NavItem[] = primaryNav.filter((i) => ["home", "assistant", "campaigns", "creatives", "insights"].includes(i.key));

export const isActivePath = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

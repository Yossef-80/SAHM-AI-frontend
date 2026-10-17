import {
  Bot,
  BrainCircuit,
  CalendarDays,
  Gauge,
  Home,
  MessageSquare,
  Megaphone,
  Image as ImageIcon,
  Lightbulb,
  Palette,
  Plug,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  key:
    | "home"
    | "brandIdentity"
    | "assistant"
    | "research"
    | "campaigns"
    | "calendar"
    | "creatives"
    | "insights"
    | "agents"
    | "integrations"
    | "settings"
    | "connectors"
    | "memory"
    | "usage"
    | "plan"
    | "audit";
  icon: LucideIcon;
  /** Rendered with a shorter label in dense contexts (mobile sheet). */
  shortKey?: string;
};

export const primaryNav: NavItem[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/brand-identity", key: "brandIdentity", icon: Palette },
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
  // Admin panel (P3): workspace configuration and operational read-outs.
  { href: "/settings/connectors", key: "connectors", icon: Plug },
  { href: "/settings/memory", key: "memory", icon: BrainCircuit },
  { href: "/settings/usage", key: "usage", icon: Gauge },
  { href: "/settings/plan", key: "plan", icon: Sparkles },
  { href: "/settings/audit", key: "audit", icon: ScrollText },
];

/** Bottom bar on mobile keeps 5 items; the rest are reachable from the sheet menu / home. */
export const mobileNav: NavItem[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/brand-identity", key: "brandIdentity", icon: Palette },
  { href: "/assistant", key: "assistant", icon: MessageSquare },
  { href: "/campaigns", key: "campaigns", icon: Megaphone },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
];

export const isActivePath = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

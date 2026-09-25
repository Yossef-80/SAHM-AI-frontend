"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  active: "bg-green-500/15 text-green-700 dark:text-green-400 border-transparent",
  succeeded: "bg-green-500/15 text-green-700 dark:text-green-400 border-transparent",
  approved: "bg-green-500/15 text-green-700 dark:text-green-400 border-transparent",
  applied: "bg-green-500/15 text-green-700 dark:text-green-400 border-transparent",
  ready: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-transparent",
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-transparent",
  generating: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-transparent",
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-transparent",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent",
  queued: "bg-muted text-muted-foreground border-transparent",
  draft: "bg-muted text-muted-foreground border-transparent",
  dismissed: "bg-muted text-muted-foreground border-transparent",
  completed: "bg-muted text-muted-foreground border-transparent",
  failed: "bg-destructive/15 text-destructive border-transparent",
  rejected: "bg-destructive/15 text-destructive border-transparent",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("status");
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", COLORS[status], className)}>
      {t.has(status) ? t(status) : status}
    </Badge>
  );
}

const SEVERITY: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-transparent",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-transparent",
  critical: "bg-destructive/15 text-destructive border-transparent",
};

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const t = useTranslations("severity");
  return (
    <Badge variant="outline" className={cn("font-medium", SEVERITY[severity], className)}>
      {t.has(severity) ? t(severity) : severity}
    </Badge>
  );
}

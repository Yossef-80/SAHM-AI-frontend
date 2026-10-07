"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-api";
import { useAuthStore } from "@/store/auth-store";
import { describeError } from "@/lib/errors";

/**
 * Portfolio switcher (P3.2).
 *
 * Switching is deliberately two effects and no request: the backend resolves a
 * workspace from the `X-Workspace-Id` header, so changing the selection changes
 * what *every* subsequent query returns. The React Query cache is then
 * invalidated wholesale — leaving another tenant's rows in the cache would be a
 * cross-tenant data leak on the next back-navigation.
 *
 * The id sent to the API is the **business id**, not the `ws_...` workspace id:
 * `WORKSPACE_HEADER` is documented as carrying a `businesses.id`, and a
 * `ws_...` value resolves to a 404.
 */
export function PortfolioSwitcher() {
  const t = useTranslations("portfolio");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const session = useSession();
  const [switching, setSwitching] = useState<string | null>(null);

  const workspaces = useAuthStore((s) => s.workspaces);
  const activeWorkspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const selectWorkspace = useAuthStore((s) => s.selectWorkspace);

  const active = workspaces.find((w) => w.workspaceId === activeWorkspaceId) ?? workspaces[0];

  if (session.isError) {
    return (
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={() => {
            session.refetch().catch((error) => toast.error(describeError(error, te)));
          }}
          className="w-full rounded-md border border-dashed px-3 py-2 text-start text-xs text-muted-foreground hover:bg-accent"
        >
          {t("loadFailed")}
        </button>
      </div>
    );
  }

  if (session.isLoading || !active) {
    return (
      <div className="space-y-2 px-3 py-2">
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  const choose = async (businessId: string) => {
    if (businessId === activeWorkspaceId) return;
    setSwitching(businessId);
    // Selects on `businessId`, because that is what `X-Workspace-Id` carries.
    selectWorkspace(businessId);
    try {
      // No filter = every query. This is the leak prevention, not a nicety.
      await qc.invalidateQueries();
      const next = workspaces.find((w) => w.businessId === businessId);
      toast.success(t("switched", { name: next?.businessName ?? "" }));
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-start text-sm transition-colors hover:bg-accent"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{active.businessName}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{t(`role.${active.role}`)}</span>
            </span>
            {switching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{t("label")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.workspaceId} onSelect={() => void choose(w.businessId)} className="gap-2">
              <Check className={`h-4 w-4 ${w.businessId === activeWorkspaceId ? "opacity-100" : "opacity-0"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{w.businessName}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{w.businessId}</span>
              </span>
              <Badge variant={w.role === "owner" ? "default" : "secondary"} className="text-[10px]">
                {t(`role.${w.role}`)}
              </Badge>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">{t("hint")}</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

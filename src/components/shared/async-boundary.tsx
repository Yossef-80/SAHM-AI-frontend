"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AsyncBoundaryProps<T> {
  isLoading: boolean;
  /** React Query v5 can be pending before its initial request starts. */
  isPending?: boolean;
  isError: boolean;
  error?: unknown;
  data: T | null | undefined;
  /** Decide emptiness. Defaults to: empty array or null/undefined. */
  isEmpty?: (data: T) => boolean;
  onRetry?: () => void;
  /** Loading skeleton. Defaults to 3 stacked rows. */
  skeleton?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Primary action shown in the empty state. */
  emptyAction?: ReactNode;
  className?: string;
  /** Rendered only in the success state; `data` is narrowed to non-null. */
  children: (data: NonNullable<T>) => ReactNode;
}

/**
 * The one place that renders the four async states: loading / error / empty / success.
 * Every data-driven view must go through it.
 */
export function AsyncBoundary<T>({
  isLoading,
  isPending = false,
  isError,
  error,
  data,
  isEmpty,
  onRetry,
  skeleton,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
  children,
}: AsyncBoundaryProps<T>) {
  const t = useTranslations("common");

  if (isPending || isLoading) {
    return <div className={className}>{skeleton ?? <DefaultSkeleton />}</div>;
  }

  if (isError) {
    const message = error instanceof Error ? error.message : t("errorGeneric");
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center", className)} role="alert">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div>
          <p className="font-medium">{t("errorTitle")}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="me-2 h-4 w-4" />
            {t("retry")}
          </Button>
        )}
      </div>
    );
  }

  const empty = data === undefined || data === null || (isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0);
  if (empty) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center", className)}>
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium">{emptyTitle ?? t("emptyTitle")}</p>
          {emptyDescription && <p className="text-sm text-muted-foreground">{emptyDescription}</p>}
        </div>
        {emptyAction}
      </div>
    );
  }

  return <>{children(data as NonNullable<T>)}</>;
}

export function DefaultSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}

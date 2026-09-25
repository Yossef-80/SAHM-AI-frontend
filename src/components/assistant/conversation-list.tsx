"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useConversations } from "@/hooks/use-api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationList({ activeId, onNavigate }: { activeId: string | null; onNavigate?: () => void }) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const q = useConversations();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3">
        <h2 className="text-sm font-medium">{t("history")}</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href="/assistant" onClick={onNavigate}>
            <Plus className="me-1 h-3.5 w-3.5" />
            {t("newChat")}
          </Link>
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <AsyncBoundary {...q} onRetry={() => q.refetch()} emptyTitle={t("noConversations")}>
          {(items) => (
            <ul className="space-y-1">
              {items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/assistant/${c.id}`}
                    onClick={onNavigate}
                    aria-current={activeId === c.id ? "page" : undefined}
                    className={cn("block rounded-md px-3 py-2 text-sm hover:bg-accent", activeId === c.id && "bg-primary/10 text-primary")}
                  >
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.lastMessagePreview}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(c.updatedAt, locale)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </div>
    </div>
  );
}

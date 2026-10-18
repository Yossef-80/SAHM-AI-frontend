"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useConversations, useDeleteConversation } from "@/hooks/use-api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationList({ activeId, onNavigate }: { activeId: string | null; onNavigate?: () => void }) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const router = useRouter();
  const q = useConversations();
  const deleteMutation = useDeleteConversation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t("deleteChatConfirm"))) return;
    try {
      setDeletingId(id);
      await deleteMutation.mutateAsync(id);
      toast.success(t("deleteChatSuccess"));
      if (activeId === id) {
        router.push("/assistant");
      }
    } catch {
      toast.error("Failed to delete chat");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-sm font-medium">{t("history")}</h2>
        <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
          <Link href="/assistant" onClick={onNavigate}>
            <Plus className="me-1 h-3.5 w-3.5" />
            {t("newChat")}
          </Link>
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <AsyncBoundary {...q} onRetry={() => q.refetch()} emptyTitle={t("noConversations")}>
          {(items) => (
            <ul className="space-y-1">
              {items.map((c) => (
                <li key={c.id} className="group relative">
                  <Link
                    href={`/assistant/${c.id}`}
                    onClick={onNavigate}
                    aria-current={activeId === c.id ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm hover:bg-accent pe-9 transition-colors",
                      activeId === c.id && "bg-primary/10 text-primary"
                    )}
                  >
                    <p className="truncate font-medium">{c.title || t("newChat")}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.lastMessagePreview}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(c.updatedAt, locale)}</p>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deletingId === c.id}
                    onClick={(e) => handleDelete(e, c.id)}
                    className="absolute top-2 end-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                    title={t("deleteChat")}
                    aria-label={t("deleteChat")}
                  >
                    {deletingId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </div>
    </div>
  );
}

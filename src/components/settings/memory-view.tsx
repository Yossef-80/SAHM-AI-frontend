"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import {
  useCreateMemoryItem,
  useDeleteMemoryItem,
  useMemoryItems,
  useReindexMemory,
  useUpdateMemoryItem,
} from "@/hooks/use-api";
import { useAuthStore } from "@/store/auth-store";
import { describeError } from "@/lib/errors";
import { MEMORY_KINDS } from "@/types";
import type { MemoryItem, MemoryKind } from "@/types";

const ALL_KINDS = "__all__";

function MemoryEditorDialog({
  item,
  defaultKind,
  canEdit,
  onClose,
}: {
  item: MemoryItem | null;
  defaultKind: MemoryKind;
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("memory");
  const te = useTranslations("errors");
  const create = useCreateMemoryItem();
  const update = useUpdateMemoryItem();
  const [kind, setKind] = useState<MemoryKind>(item?.kind ?? defaultKind);
  const [text, setText] = useState(item?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const submit = async () => {
    if (text.trim().length === 0) {
      setError(t("textRequired"));
      return;
    }
    try {
      if (item) await update.mutateAsync({ id: item.id, text: text.trim() });
      else await create.mutateAsync({ kind, text: text.trim(), metadata: {}, campaignId: null });
      toast.success(item ? t("updated") : t("created"));
      onClose();
    } catch (e) {
      setError(describeError(e, te));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{item ? t("editTitle") : t("createTitle")}</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("cancel")}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!item && (
            <div className="space-y-1.5">
              <Label>{t("kindLabel")}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as MemoryKind)} disabled={busy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMORY_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`kind.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t(`kindHint.${kind}`)}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="memory-text">{t("text")}</Label>
            <Textarea
              id="memory-text"
              rows={6}
              value={text}
              disabled={busy}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
            <p className="text-xs text-muted-foreground">{t("textHint")}</p>
          </div>
          {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={busy || !canEdit}>
              <Save className="me-2 h-4 w-4" />
              {busy ? t("saving") : t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function MemoryView() {
  const t = useTranslations("memory");
  const te = useTranslations("errors");
  const role = useAuthStore((s) => s.activeRole);
  const canEdit = role === null || role === "owner" || role === "member";
  const canReindex = role === null || role === "owner";

  const [kind, setKind] = useState<string>(ALL_KINDS);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ item: MemoryItem | null; kind: MemoryKind } | null>(null);

  const listInput = { kind: kind === ALL_KINDS ? undefined : (kind as MemoryKind), q: query || undefined, limit: 100 };
  const query_ = useMemoryItems(listInput);
  const remove = useDeleteMemoryItem();
  const reindex = useReindexMemory();

  const deleteItem = async (item: MemoryItem) => {
    try {
      await remove.mutateAsync(item.id);
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(describeError(error, te));
    }
  };

  const runReindex = async () => {
    try {
      const result = await reindex.mutateAsync(kind === ALL_KINDS ? undefined : kind);
      toast.success(
        result.kind
          ? t("reindexedKind", { count: result.reindexed, kind: t(`kind.${result.kind}`) })
          : t("reindexed", { count: result.reindexed }),
      );
    } catch (error) {
      toast.error(describeError(error, te));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void runReindex()} disabled={!canReindex || reindex.isPending}>
              <RefreshCw className={`me-2 h-4 w-4 ${reindex.isPending ? "animate-spin" : ""}`} />
              {reindex.isPending ? t("reindexing") : t("reindex")}
            </Button>
            <Button
              size="sm"
              disabled={!canEdit}
              onClick={() => setEditing({ item: null, kind: kind === ALL_KINDS ? "voice_example" : (kind as MemoryKind) })}
            >
              <Plus className="me-2 h-4 w-4" />
              {t("create")}
            </Button>
          </>
        }
      />

      {!canEdit && (
        <p className="mb-4 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t("readOnlyRole")}
        </p>
      )}
      {!canReindex && canEdit && (
        <p className="mb-4 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t("reindexOwnerOnly")}
        </p>
      )}

      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(searchInput.trim());
        }}
      >
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_KINDS}>{t("allKinds")}</SelectItem>
            {MEMORY_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`kind.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
            aria-label={t("search")}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            {t("search")}
          </Button>
          {query && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setQuery("");
              }}
            >
              {t("clearSearch")}
            </Button>
          )}
        </div>
      </form>

      <AsyncBoundary
        isLoading={query_.isLoading}
        isError={query_.isError}
        error={query_.error}
        data={query_.data}
        isEmpty={(d) => d.items.length === 0}
        onRetry={() => void query_.refetch()}
        emptyTitle={query ? t("noResultsTitle") : t("emptyTitle")}
        emptyDescription={query ? t("noResultsDescription") : t("emptyDescription")}
        skeleton={<div className="h-72" />}
      >
        {(data) => (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {data.mode === "similar" ? t("similarHint", { count: data.total }) : t("count", { count: data.total })}
            </p>
            <ul className="space-y-2">
              {data.items.map((item) => (
                <li key={item.id}>
                  <Card>
                    <CardContent className="space-y-2 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{t(`kind.${item.kind}`)}</Badge>
                          {item.score !== null && item.score !== undefined && (
                            <Badge variant="outline">{t("score", { value: Math.round(item.score * 100) })}</Badge>
                          )}
                          {item.campaignId && <Badge variant="outline">{item.campaignId}</Badge>}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t("edit")}
                              onClick={() => setEditing({ item, kind: item.kind })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t("delete")}
                              disabled={remove.isPending}
                              onClick={() => void deleteItem(item)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{item.text}</p>
                      {item.createdAt && <p className="text-[11px] text-muted-foreground">{item.createdAt.slice(0, 16).replace("T", " ")}</p>}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AsyncBoundary>

      {editing && (
        <MemoryEditorDialog
          item={editing.item}
          defaultKind={editing.kind}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { ImagePlus, Loader2, Star, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreativeReferences, useUpdateCreativeReference } from "@/hooks/use-api";

type ReferenceTarget = { id: string; sourceName: string };

type Props = {
  onStartPrompt: (kind: "image" | "video", reference: ReferenceTarget) => void;
};

export function ReferenceLibrary({ onStartPrompt }: Props) {
  const t = useTranslations("creatives.references");
  const tc = useTranslations("common");
  const locale = useLocale();
  const query = useCreativeReferences();
  const update = useUpdateCreativeReference();

  if (query.isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
        <p>{t("error")}</p>
        <Button className="mt-2" size="sm" variant="outline" onClick={() => void query.refetch()}>{tc("retry")}</Button>
      </div>
    );
  }
  if (!query.data?.length) return null;

  const references = [...query.data].sort((a, b) => Number(b.favorite) - Number(a.favorite));
  const start = (kind: "image" | "video", reference: ReferenceTarget) => onStartPrompt(kind, reference);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {references.map((reference) => {
          const target = { id: reference.id, sourceName: reference.sourceName };
          const palette = reference.style.palette.slice(0, 5);
          return (
            <article key={reference.id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-3" dir="auto">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{reference.sourceName}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                    {reference.summary || t("noSummary")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={reference.favorite ? t("unfavorite") : t("favorite")}
                  title={reference.favorite ? t("unfavorite") : t("favorite")}
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: reference.id, favorite: !reference.favorite })}
                >
                  <Star className={`h-4 w-4 ${reference.favorite ? "fill-amber-400 text-amber-500" : ""}`} />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {palette.map((color, index) => (
                  <Badge key={`${color}-${index}`} variant="outline" className="gap-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full border"
                      style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(color) ? color : "transparent" }}
                      aria-hidden="true"
                    />
                    {color}
                  </Badge>
                ))}
                {reference.style.tone && <Badge variant="secondary">{reference.style.tone}</Badge>}
                {reference.favorite && <Badge>{t("favoriteLabel")}</Badge>}
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                {reference.style.composition && <p><span className="font-medium">{t("composition")}: </span>{reference.style.composition}</p>}
                {reference.style.layoutPattern && <p><span className="font-medium">{t("layout")}: </span>{reference.style.layoutPattern}</p>}
              </div>
              {reference.createdAt && (
                <p className="text-[11px] text-muted-foreground">
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(reference.createdAt))}
                </p>
              )}
              <div className="mt-auto grid gap-2 sm:grid-cols-2">
                <Button type="button" size="sm" variant="outline" onClick={() => start("image", target)}>
                  <ImagePlus className="me-2 h-4 w-4" /> {t("useForImage")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => start("video", target)}>
                  <Video className="me-2 h-4 w-4" /> {t("useForVideo")}
                </Button>
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}

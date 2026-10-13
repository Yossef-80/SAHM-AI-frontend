"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Loader2,
  Megaphone,
  Palette,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBrandIdentity, useSyncBrandIdentity, useUpdateBrandIdentity } from "@/hooks/use-api";
import { useUiStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import type { BrandIdentityUpdateRequest } from "@/types";

export function BrandIdentityView() {
  const t = useTranslations("brand");
  const tc = useTranslations("common");
  const router = useRouter();
  const setCampaignPrefill = useUiStore((s) => s.setCampaignPrefill);

  const { data: brand, isLoading, isError, refetch } = useBrandIdentity();
  const syncMutation = useSyncBrandIdentity();
  const updateMutation = useUpdateBrandIdentity();

  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<BrandIdentityUpdateRequest>({});

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    toast.success(`${t("copied")} (${hex})`);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("syncSuccess"));
      },
      onError: () => {
        toast.error(t("syncError"));
      },
    });
  };

  const openEditModal = () => {
    if (!brand) return;
    setEditForm({
      brandName: brand.brandName,
      industry: brand.industry,
      palette: { ...brand.palette },
      essence: { ...brand.essence },
      targetAudience: { ...brand.targetAudience },
      swot: { ...brand.swot },
      keyOffers: [...brand.keyOffers],
      competitors: [...brand.competitors],
      marketGaps: [...brand.marketGaps],
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate(editForm, {
      onSuccess: () => {
        setIsEditOpen(false);
        toast.success(t("syncSuccess"));
      },
      onError: () => {
        toast.error("Failed to update brand profile.");
      },
    });
  };

  const handleLaunchCampaign = () => {
    if (!brand) return;
    setCampaignPrefill({
      name: `${brand.brandName} - Growth Campaign`,
      objective: "sales",
      dailyBudget: 500,
      currency: "EGP",
      strategy: {
        summary: `Drive growth and sales for ${brand.brandName}. ${brand.essence.tagline || ""}. Focus on our primary offers: ${brand.keyOffers.join(", ")}`,
        keyMessages:
          brand.essence.toneKeywords.length > 0
            ? brand.essence.toneKeywords
            : [brand.essence.brandVoice || "Quality and value"],
        channels: ["facebook", "instagram"],
        placements: ["Feed", "Stories", "Reels"],
        biddingStrategy: "lowest_cost",
        phases: [
          { name: "Awareness & Engagement", durationDays: 7, focus: "Audience reach & video views" },
          { name: "Conversion & Retargeting", durationDays: 23, focus: "Direct sales & lead generation" },
        ],
        kpis: [
          { metric: "CTR", target: 2.5 },
          { metric: "ROAS", target: 3.5 },
        ],
      },
      audience: {
        name: brand.targetAudience.summary || `${brand.brandName} Core Audience`,
        locations: ["Cairo, EG", "Giza, EG", "Alexandria, EG"],
        ageMin: 22,
        ageMax: 45,
        genders: ["all"],
        interests: brand.essence.toneKeywords,
        behaviors: [],
      },
    });
    router.push("/campaigns/new");
  };

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("syncing")}</p>
      </div>
    );
  }

  if (isError || !brand) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-center">
        <Palette className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{t("noIdentityNotice")}</p>
        <Button onClick={() => refetch()} variant="outline">
          {tc("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{brand.brandName}</h1>
              <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold">
                {brand.industry}
              </Badge>
              {brand.syncedAt && (
                <span className="text-xs text-muted-foreground">
                  {t("lastSynced")}: {new Date(brand.syncedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {brand.essence.tagline && (
              <p className="text-base font-medium text-muted-foreground">
                &ldquo;{brand.essence.tagline}&rdquo;
              </p>
            )}
            <p className="max-w-2xl text-xs text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              variant="default"
              size="sm"
              className="gap-1.5 shadow-sm"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {syncMutation.isPending ? t("syncing") : t("syncButton")}
            </Button>

            <Button onClick={openEditModal} variant="outline" size="sm" className="gap-1.5">
              <Edit3 className="h-4 w-4" />
              {t("editButton")}
            </Button>

            <Button
              onClick={handleLaunchCampaign}
              variant="secondary"
              size="sm"
              className="gap-1.5"
            >
              <Megaphone className="h-4 w-4" />
              Launch Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Color Palette Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">{t("paletteTitle")}</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">Click to copy hex</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {[
              { label: t("primaryColor"), hex: brand.palette.primary },
              { label: t("secondaryColor"), hex: brand.palette.secondary },
              { label: t("accentColor"), hex: brand.palette.accent },
              { label: "Background", hex: brand.palette.background },
              { label: "Text Tone", hex: brand.palette.text },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => handleCopyHex(c.hex)}
                className="group relative flex flex-col items-center overflow-hidden rounded-lg border bg-card p-3 text-left transition hover:border-primary/50 hover:shadow-sm"
              >
                <div
                  className="mb-2 h-14 w-full rounded-md border shadow-inner transition-transform group-hover:scale-105"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-xs font-semibold">{c.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.hex}</span>
                {copiedHex === c.hex ? (
                  <Check className="absolute right-2 top-2 h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="absolute right-2 top-2 h-3.5 w-3.5 opacity-0 transition group-hover:opacity-70" />
                )}
              </button>
            ))}
          </div>

          {/* Extended Swatch Strip */}
          {brand.palette.palette && brand.palette.palette.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <span className="text-xs font-medium text-muted-foreground">Extended Palette:</span>
              <div className="mt-2 flex h-8 w-full overflow-hidden rounded-md border shadow-sm">
                {brand.palette.palette.map((color, idx) => (
                  <div
                    key={idx}
                    className="flex-1 cursor-pointer transition hover:opacity-90"
                    style={{ backgroundColor: color }}
                    title={color}
                    onClick={() => handleCopyHex(color)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2-Column: Essence & Voice + Target Audience */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Identity & Voice */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">{t("voiceTitle")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {brand.essence.mission && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("mission")}
                </span>
                <p className="mt-1 text-sm leading-relaxed">{brand.essence.mission}</p>
              </div>
            )}

            {brand.essence.vision && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("vision")}
                </span>
                <p className="mt-1 text-sm leading-relaxed">{brand.essence.vision}</p>
              </div>
            )}

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("brandVoice")}
              </span>
              <p className="mt-1 text-sm text-foreground">
                {brand.essence.brandVoice || "Professional, approachable, and result-driven."}
              </p>
            </div>

            {brand.essence.toneKeywords && brand.essence.toneKeywords.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("toneKeywords")}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brand.essence.toneKeywords.map((kw, i) => (
                    <Badge key={i} variant="outline" className="border-primary/30 bg-primary/5 text-xs text-primary">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Target Audience Profile */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">{t("audienceTitle")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("idealCustomer")}
              </span>
              <p className="mt-1 text-sm leading-relaxed">
                {brand.targetAudience.summary || "High-intent consumers seeking quality and consistency."}
              </p>
            </div>

            {brand.targetAudience.demographics && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("demographics")}
                </span>
                <p className="mt-1 text-sm text-foreground">{brand.targetAudience.demographics}</p>
              </div>
            )}

            {brand.targetAudience.painPoints && brand.targetAudience.painPoints.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("painPoints")}
                </span>
                <ul className="mt-1.5 space-y-1.5 text-sm">
                  {brand.targetAudience.painPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Strategic SWOT Analysis Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">{t("swotTitle")}</CardTitle>
          </div>
          <CardDescription>
            Calculated matrix of internal capabilities and external market forces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Strengths */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 transition hover:border-emerald-500/50">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <h4 className="text-sm font-semibold">{t("strengths")}</h4>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-sm text-foreground">
                {brand.swot.strengths.length > 0 ? (
                  brand.swot.strengths.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-muted-foreground">{t("emptyItems")}</li>
                )}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 transition hover:border-rose-500/50">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                <h4 className="text-sm font-semibold">{t("weaknesses")}</h4>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-sm text-foreground">
                {brand.swot.weaknesses.length > 0 ? (
                  brand.swot.weaknesses.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-rose-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-muted-foreground">{t("emptyItems")}</li>
                )}
              </ul>
            </div>

            {/* Opportunities */}
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 transition hover:border-blue-500/50">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-4 w-4" />
                <h4 className="text-sm font-semibold">{t("opportunities")}</h4>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-sm text-foreground">
                {brand.swot.opportunities.length > 0 ? (
                  brand.swot.opportunities.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-muted-foreground">{t("emptyItems")}</li>
                )}
              </ul>
            </div>

            {/* Threats */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 transition hover:border-amber-500/50">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4" />
                <h4 className="text-sm font-semibold">{t("threats")}</h4>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-sm text-foreground">
                {brand.swot.threats.length > 0 ? (
                  brand.swot.threats.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-muted-foreground">{t("emptyItems")}</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3-Column: Offers, Competitors, and Gaps */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Key Offers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">{t("offersTitle")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {brand.keyOffers.length > 0 ? (
                brand.keyOffers.map((offer, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md border bg-muted/20 p-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span>{offer}</span>
                  </li>
                ))
              ) : (
                <li className="text-xs text-muted-foreground">{t("emptyItems")}</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Competitors */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">{t("competitorsTitle")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {brand.competitors.length > 0 ? (
                brand.competitors.map((comp, i) => (
                  <Badge key={i} variant="secondary" className="px-3 py-1 text-xs">
                    {comp}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">{t("emptyItems")}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Market Gaps */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">{t("marketGapsTitle")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {brand.marketGaps.length > 0 ? (
                brand.marketGaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{gap}</span>
                  </li>
                ))
              ) : (
                <li className="text-xs text-muted-foreground">{t("emptyItems")}</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editButton")}</DialogTitle>
            <DialogDescription>
              Directly edit and customize your brand profile and visual identity.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brandName">{t("brandName")}</Label>
                <Input
                  id="brandName"
                  value={editForm.brandName ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">{t("industry")}</Label>
                <Input
                  id="industry"
                  value={editForm.industry ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tagline">{t("tagline")}</Label>
              <Input
                id="tagline"
                value={editForm.essence?.tagline ?? ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    essence: { ...editForm.essence, tagline: e.target.value },
                  })
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="primColor" className="text-xs">{t("primaryColor")}</Label>
                <Input
                  id="primColor"
                  value={editForm.palette?.primary ?? ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      palette: { ...editForm.palette, primary: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="secColor" className="text-xs">{t("secondaryColor")}</Label>
                <Input
                  id="secColor"
                  value={editForm.palette?.secondary ?? ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      palette: { ...editForm.palette, secondary: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="accColor" className="text-xs">{t("accentColor")}</Label>
                <Input
                  id="accColor"
                  value={editForm.palette?.accent ?? ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      palette: { ...editForm.palette, accent: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mission">{t("mission")}</Label>
              <Textarea
                id="mission"
                rows={2}
                value={editForm.essence?.mission ?? ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    essence: { ...editForm.essence, mission: e.target.value },
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vision">{t("vision")}</Label>
              <Textarea
                id="vision"
                rows={2}
                value={editForm.essence?.vision ?? ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    essence: { ...editForm.essence, vision: e.target.value },
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audience">{t("idealCustomer")}</Label>
              <Textarea
                id="audience"
                rows={2}
                value={editForm.targetAudience?.summary ?? ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    targetAudience: { ...editForm.targetAudience, summary: e.target.value },
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("saving") : t("saveButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

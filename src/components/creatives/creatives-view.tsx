"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Image as ImageIcon, PenLine, ScanSearch, Sparkles, Video, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary, CardGridSkeleton } from "@/components/shared/async-boundary";
import { useAction } from "@/hooks/use-action";
import { useCampaigns, useCreatives } from "@/hooks/use-api";
import { CreativeKindSchema, type CreativeKind } from "@/types";
import { CreativeCard } from "./creative-card";
import { CreateCreativeDialog } from "./create-creative-dialog";
import { AnalyzeReferenceDialog } from "./analyze-reference-dialog";
import { GenerateTextDialog } from "./generate-text-dialog";
import { TextToolSchema, type TextTool } from "@/types";

const kindIcon = { image: ImageIcon, video: Video, copy: FileText };

export function CreativesView() {
  const t = useTranslations("creatives");
  const tc = useTranslations("common");
  const tk = useTranslations("kind");
  const tt = useTranslations("creatives.textTools");
  const { dispatch } = useAction();
  const [kind, setKind] = useState<CreativeKind | "all">("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [refOpen, setRefOpen] = useState(false);
  const [textTool, setTextTool] = useState<TextTool | null>(null);
  const q = useCreatives(campaignId === "all" ? undefined : campaignId);
  const campaigns = useCampaigns();

  return (
    <div>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button variant="outline" onClick={() => setRefOpen(true)}>
              <ScanSearch className="me-2 h-4 w-4" />
              {t("analyzeReference")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <PenLine className="me-2 h-4 w-4" />
                  {t("generateText")}
                  <ChevronDown className="ms-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {TextToolSchema.options.map((k) => (
                  <DropdownMenuItem key={k} onClick={() => setTextTool(k)}>
                    {tt(`tools.${k}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Sparkles className="me-2 h-4 w-4" />
                  {t("create")}
                  <ChevronDown className="ms-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {CreativeKindSchema.options.map((k) => {
                  const Icon = kindIcon[k];
                  return (
                    <DropdownMenuItem key={k} onClick={() => dispatch({ type: "CREATE_CREATIVE", payload: { kind: k } })}>
                      <Icon className="me-2 h-4 w-4" />
                      {tk(k)}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={kind} onValueChange={(v) => setKind(v as CreativeKind | "all")}>
          <SelectTrigger className="sm:w-40" aria-label={t("filterKind")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("all")}</SelectItem>
            {CreativeKindSchema.options.map((k) => (
              <SelectItem key={k} value={k}>
                {tk(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger className="sm:w-60" aria-label={t("filterCampaign")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("all")}</SelectItem>
            {(campaigns.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AsyncBoundary
        {...q}
        data={q.data?.filter((c) => kind === "all" || c.kind === kind)}
        onRetry={() => q.refetch()}
        skeleton={<CardGridSkeleton />}
        emptyTitle={t("empty")}
        emptyDescription={t("emptyDesc")}
        emptyAction={
          <Button size="sm" onClick={() => dispatch({ type: "CREATE_CREATIVE", payload: { kind: "image" } })}>
            <Sparkles className="me-2 h-4 w-4" />
            {t("create")}
          </Button>
        }
      >
        {(list) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((c) => (
              <CreativeCard key={c.id} creative={c} showActions />
            ))}
          </div>
        )}
      </AsyncBoundary>

      <CreateCreativeDialog />
      <AnalyzeReferenceDialog open={refOpen} onOpenChange={setRefOpen} />
      <GenerateTextDialog open={textTool !== null} onOpenChange={(o) => !o && setTextTool(null)} initialTool={textTool ?? undefined} campaignId={campaignId === "all" ? null : campaignId} />
    </div>
  );
}

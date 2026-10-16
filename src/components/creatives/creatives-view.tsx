"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Image as ImageIcon, PenLine, ScanSearch, Sparkles, Video, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary, CardGridSkeleton } from "@/components/shared/async-boundary";
import { useAction } from "@/hooks/use-action";
import { useCampaigns, useCreatives, useImageGenerationReady } from "@/hooks/use-api";
import { useUiStore } from "@/store/ui-store";
import { useAssistantStore } from "@/store/assistant-store";
import { CreativeKindSchema, TextToolSchema, type Creative, type CreativeKind, type TextTool } from "@/types";
import { CreativeCard } from "./creative-card";
import { CreateCreativeDialog } from "./create-creative-dialog";
import { AnalyzeReferenceDialog } from "./analyze-reference-dialog";
import { EditCopyDialog } from "./edit-copy-dialog";
import { GenerateTextDialog } from "./generate-text-dialog";
import { ReferenceLibrary } from "./reference-library";

const kindIcon = { image: ImageIcon, video: Video, copy: FileText };

export function CreativesView() {
  const t = useTranslations("creatives");
  const tc = useTranslations("common");
  const tk = useTranslations("kind");
  const tt = useTranslations("creatives.textTools");
  const { dispatch } = useAction();
  const router = useRouter();
  const locale = useLocale();
  const setPendingPrompt = useAssistantStore((state) => state.setPendingPrompt);
  const [kind, setKind] = useState<CreativeKind | "all">("all");
  const [editingCopy, setEditingCopy] = useState<Creative | null>(null);
  const [campaignId, setCampaignId] = useState<string>("all");
  const [refOpen, setRefOpen] = useState(false);
  const [textTool, setTextTool] = useState<TextTool | null>(null);
  const [textBrief, setTextBrief] = useState("");
  const [textCreativeId, setTextCreativeId] = useState<string | null>(null);
  const [textCampaignId, setTextCampaignId] = useState<string | null | undefined>(undefined);
  const textRequest = useUiStore((s) => s.textRequest);
  const setTextRequest = useUiStore((s) => s.setTextRequest);
  const q = useCreatives(campaignId === "all" ? undefined : campaignId);
  const campaigns = useCampaigns();
  const imageGeneration = useImageGenerationReady();

  const startLaylaPrompt = useCallback((
    promptType: "image" | "video",
    reference?: { id: string; sourceName: string },
    startingBrief?: string,
  ) => {
    const promptText = locale === "ar"
      ? `ليلى، أريد إعداد برومبت قوي لتوليد ${promptType === "image" ? "صورة" : "فيديو"}. ابدئي بقائمة واحدة مجمّعة للتفاصيل الناقصة. إذا أرفقت مرجعًا، اعرضي تحليل الصورة وما تقترحين الحفاظ عليه أو تغييره، ثم انتظري موافقتي قبل كتابة البرومبت النهائي. لا تولّدي أي وسائط.${startingBrief ? `\n\nموجزي المبدئي: ${startingBrief}` : ""}`
      : `Layla, I want to build a strong ${promptType} generation prompt. Start with one grouped checklist of missing details. If a reference is attached, show what you observed and propose what to preserve or change, then wait for my approval before writing the final prompt. Do not generate media.${startingBrief ? `\n\nMy starting brief: ${startingBrief}` : ""}`;
    const referenceChip = reference
      ? [{ kind: "reference" as const, id: reference.id, label: reference.sourceName }]
      : [];
    setPendingPrompt({
      text: promptText,
      context: referenceChip,
      personaId: "layla",
      workflow: "creative_prompt",
      promptType,
      // Enforced, not merely requested. The gate in core_bridge refuses
      // generate_image while creative_mode is "prompt", so a stray "اعمل صورة"
      // mid-interview cannot produce an asset before the prompt is approved.
      // The prose above is now only a hint about what to output.
      creativeMode: "prompt",
      referenceAnalysisId: reference?.id,
    });
    setRefOpen(false);
    router.push("/assistant");
  }, [locale, router, setPendingPrompt]);

  useEffect(() => {
    if (!textRequest) return;
    if (textRequest.tool === "generate_image_prompt" || textRequest.tool === "generate_video_prompt") {
      startLaylaPrompt(
        textRequest.tool === "generate_image_prompt" ? "image" : "video",
        undefined,
        textRequest.brief,
      );
      setTextRequest(null);
      return;
    }
    setTextBrief(textRequest.brief);
    setTextCreativeId(textRequest.creativeId ?? null);
    setTextCampaignId(textRequest.campaignId ?? null);
    setTextTool(textRequest.tool);
    setTextRequest(null);
  }, [textRequest, setTextRequest, startLaylaPrompt]);

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
                  <DropdownMenuItem
                    key={k}
                    onClick={() => {
                      if (k === "generate_image_prompt" || k === "generate_video_prompt") {
                        startLaylaPrompt(k === "generate_image_prompt" ? "image" : "video");
                        return;
                      }
                      setTextBrief("");
                      setTextCreativeId(null);
                      setTextCampaignId(undefined);
                      setTextTool(k);
                    }}
                  >
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
                  // Image is the only kind that calls the image provider. `video`
                  // opens a Layla prompt-interview and `copy` uses the LLM, so
                  // neither is blocked by a missing image model.
                  const blocked = k === "image" && !imageGeneration.isLoading && !imageGeneration.ready;
                  return (
                    <DropdownMenuItem
                      key={k}
                      disabled={blocked}
                      title={blocked ? t("imageProviderMissing") : undefined}
                      onClick={() => {
                        if (k === "image") {
                          void dispatch({
                            type: "CREATE_CREATIVE",
                            payload: { kind: "image", campaignId: campaignId === "all" ? null : campaignId },
                          });
                        } else if (k === "video") {
                          startLaylaPrompt("video");
                        } else {
                          setTextBrief("");
                          setTextCreativeId(null);
                          setTextCampaignId(campaignId === "all" ? null : campaignId);
                          setTextTool("generate_ad_copy");
                        }
                      }}
                    >
                      <Icon className="me-2 h-4 w-4" />
                      {tk(k)}
                      {blocked && (
                        <span className="ms-auto text-xs text-muted-foreground">
                          {t("imageProviderMissingShort")}
                        </span>
                      )}
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

      <ReferenceLibrary onStartPrompt={(kind, reference) => startLaylaPrompt(kind, reference)} />

      <AsyncBoundary
        {...q}
        data={q.data?.filter((c) => kind === "all" || c.kind === kind)}
        onRetry={() => q.refetch()}
        skeleton={<CardGridSkeleton />}
        emptyTitle={t("empty")}
        emptyDescription={t("emptyDesc")}
        emptyAction={
          <Button
            size="sm"
            disabled={!imageGeneration.isLoading && !imageGeneration.ready}
            title={imageGeneration.ready ? undefined : t("imageProviderMissing")}
            onClick={() => dispatch({ type: "CREATE_CREATIVE", payload: { kind: "image", campaignId: campaignId === "all" ? null : campaignId } })}
          >
            <Sparkles className="me-2 h-4 w-4" />
            {t("create")}
          </Button>
        }
      >
        {(list) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((c) => (
              <CreativeCard
                key={c.id}
                creative={c}
                showActions
                onGenerateVariations={(creative) => {
                  setTextBrief([
                    creative.title,
                    creative.headline,
                    creative.primaryText,
                    creative.cta,
                  ].filter(Boolean).join("\n"));
                  setTextCreativeId(creative.id);
                  setTextCampaignId(creative.campaignId);
                  setTextTool("generate_ad_variations");
                }}
                onEditCopy={setEditingCopy}
              />
            ))}
          </div>
        )}
      </AsyncBoundary>

      <EditCopyDialog
        creative={editingCopy}
        onOpenChange={(open) => {
          if (!open) setEditingCopy(null);
        }}
      />
      <CreateCreativeDialog />
      <AnalyzeReferenceDialog
        open={refOpen}
        onOpenChange={setRefOpen}
        onStartPrompt={(promptType, reference) => startLaylaPrompt(promptType, reference)}
      />
      <GenerateTextDialog
        open={textTool !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTextTool(null);
            setTextBrief("");
            setTextCreativeId(null);
            setTextCampaignId(undefined);
          }
        }}
        initialTool={textTool ?? undefined}
        initialBrief={textBrief}
        campaignId={textCampaignId !== undefined ? textCampaignId : campaignId === "all" ? null : campaignId}
        creativeId={textCreativeId}
      />
    </div>
  );
}

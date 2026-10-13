"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { 
  AlertTriangle,
  ArrowRight, 
  AtSign, 
  BrainCircuit, 
  CheckCircle2, 
  Compass, 
  Crosshair, 
  ExternalLink,
  Globe, 
  Globe2, 
  Images, 
  KeyRound, 
  Loader2, 
  Sparkles, 
  Star, 
  X, 
  type LucideIcon 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { getAccessToken, getActiveWorkspaceId } from "@/store/auth-store";

export type ToolKey =
  | "analyze_website"
  | "analyze_competitor"
  | "analyze_social_profile"
  | "analyze_reviews"
  | "analyze_market"
  | "analyze_keywords"
  | "analyze_competitor_creatives"
  | "detect_market_gaps"
  | "generate_marketing_strategy";

interface SourceItem {
  title?: string;
  url?: string;
}

interface ResearchItem {
  id: string;
  tool: string;
  query: string;
  title: string;
  summary: string;
  details?: {
    subject?: string;
    tool?: string;
    analyzed_at?: string;
    sources?: SourceItem[];
    verification_status?: "verified" | "typo_corrected" | "not_found";
    corrected_from?: string;
    explanation?: string;
    [key: string]: unknown;
  };
  saved_to_memory?: boolean;
  created_at: string;
}

interface ToolConfig {
  key: ToolKey;
  icon: LucideIcon;
  /**
   * Titles, descriptions and placeholders are resolved from the message
   * catalogue at render time (``research.tools.<key>.*``) so both locales stay in
   * sync with the backend's tool keys.
   */
  field: string | null;
  required: boolean;
  type?: "url" | "text";
}

const TOOLS: ToolConfig[] = [
  { 
    key: "analyze_website", 
    icon: Globe, 
    field: "url", 
    required: true, 
    type: "url" 
  },
  { 
    key: "analyze_competitor", 
    icon: Crosshair, 
    field: "competitor", 
    required: false 
  },
  { 
    key: "analyze_social_profile", 
    icon: AtSign, 
    field: "handle", 
    required: true 
  },
  { 
    key: "analyze_reviews", 
    icon: Star, 
    field: "url", 
    required: false 
  },
  { 
    key: "analyze_market", 
    icon: Compass, 
    field: "category", 
    required: false 
  },
  { 
    key: "analyze_keywords", 
    icon: KeyRound, 
    field: "seed", 
    required: true 
  },
  { 
    key: "analyze_competitor_creatives", 
    icon: Images, 
    field: "competitor", 
    required: false 
  },
  { 
    key: "detect_market_gaps", 
    icon: Sparkles, 
    field: null, 
    required: false 
  },
  { 
    key: "generate_marketing_strategy", 
    icon: BrainCircuit, 
    field: "notes", 
    required: false 
  },
];

// Helper to strip Python dict/JSON string wrappers
function cleanClientText(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();
  if (
    text.startsWith("{'type'") || 
    text.startsWith("[{'type'") || 
    text.startsWith('{"type"') || 
    text.startsWith('[{"type"')
  ) {
    const match = text.match(/['"]text['"]\s*:\s*['"]([\s\S]*?)['"](?:\s*,\s*['"][a-zA-Z_]+['"]|\s*})/);
    if (match) {
      text = match[1];
    }
  }
  return text.replace(/\\n/g, "\n");
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5"
        >
          {linkMatch[1]}
          <ExternalLink className="h-2.5 w-2.5 inline shrink-0" />
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MarkdownReport({ content }: { content: string }) {
  const cleaned = cleanClientText(content);
  const lines = cleaned.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      continue;
    }

    // Horizontal Rule
    if (line === "---" || line === "***" || line === "___") {
      elements.push(<hr key={i} className="my-2.5 border-border/40" />);
      continue;
    }

    // Markdown Headings: # through ######
    const headingMatch = line.match(/^(#{1,6})\s*(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      if (level === 1) {
        elements.push(
          <h2 key={i} className="text-sm font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/60 flex items-center gap-1.5">
            {renderInlineMarkdown(headingText)}
          </h2>
        );
      } else if (level === 2) {
        elements.push(
          <h3 key={i} className="text-xs font-bold text-foreground mt-3 mb-1.5 pb-1 border-b border-border/40 flex items-center gap-1.5">
            {renderInlineMarkdown(headingText)}
          </h3>
        );
      } else if (level === 3) {
        elements.push(
          <h4 key={i} className="text-xs font-semibold text-foreground/90 mt-2.5 mb-1 flex items-center gap-1">
            {renderInlineMarkdown(headingText)}
          </h4>
        );
      } else {
        elements.push(
          <h5 key={i} className="text-[11px] font-semibold text-foreground/80 mt-2 mb-0.5 uppercase tracking-wide">
            {renderInlineMarkdown(headingText)}
          </h5>
        );
      }
      continue;
    }

    // Blockquotes
    if (line.startsWith(">")) {
      const quoteText = line.replace(/^>\s*/, "");
      elements.push(
        <div key={i} className="border-s-2 border-primary/70 bg-primary/5 px-2.5 py-1.5 rounded-r my-2 text-xs text-foreground/90">
          {renderInlineMarkdown(quoteText)}
        </div>
      );
      continue;
    }

    // Numbered Lists: "1. item" or "1) item"
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/85 my-0.5 ms-1">
          <span className="text-primary font-semibold text-[11px] shrink-0 min-w-[14px]">{numMatch[1]}.</span>
          <span className="leading-relaxed">{renderInlineMarkdown(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet Lists
    const bulletMatch = line.match(/^([•\-\*])\s+(.+)$/);
    if (bulletMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/85 my-0.5 ms-1">
          <span className="text-primary mt-1 text-[7px] shrink-0">●</span>
          <span className="leading-relaxed">{renderInlineMarkdown(bulletMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Standard Paragraph
    elements.push(
      <p key={i} className="text-xs text-foreground/85 leading-relaxed my-0.5">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

export function ResearchView() {
  const t = useTranslations("research");
  const locale = useLocale();
  const [activeResearch, setActiveResearch] = useState<ResearchItem | null>(null);
  const [recentItems, setRecentItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingTool, setPendingTool] = useState<ToolKey | null>(null);
  const [currentQuery, setCurrentQuery] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

  // Fetch recent research on mount
  const fetchRecent = useCallback(async () => {
    try {
      const token = getAccessToken();
      const wsId = getActiveWorkspaceId();
      const headers: Record<string, string> = { "Accept": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (wsId) headers["X-Workspace-Id"] = wsId;

      const res = await fetch(`${apiBase}/research/items`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecentItems(data);
      }
    } catch {
      // Ignore network errors on initial mount
    }
  }, [apiBase]);

  useEffect(() => {
    void fetchRecent();
  }, [fetchRecent]);

  const handleRunTool = async (toolKey: ToolKey, queryValue: string) => {
    if (loading) return;

    setLoading(true);
    setPendingTool(toolKey);
    setCurrentQuery(queryValue.trim());

    try {
      const token = getAccessToken();
      const wsId = getActiveWorkspaceId();
      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
        "Accept": "application/json" 
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (wsId) headers["X-Workspace-Id"] = wsId;

      const res = await fetch(`${apiBase}/research/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tool: toolKey,
          query: queryValue.trim(),
          language: locale,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || "Failed to execute research");
      }

      const data: ResearchItem = await res.json();
      setActiveResearch(data);
      if (data.saved_to_memory !== false) {
        toast.success(`تم استخراج وحفظ تقرير الاستخبارات لـ "${queryValue || toolKey}"`);
        await fetchRecent();
      } else {
        toast.warning(`تنبيه التحقق: لم يتم التحقق من الكيان في السوق.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`فشل تشغيل أداة البحث: ${msg}`);
    } finally {
      setLoading(false);
      setPendingTool(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("desc")} />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Left Side: Interactive Tools Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCard
              key={tool.key}
              tool={tool}
              isPending={pendingTool === tool.key && loading}
              isAnyBusy={loading}
              onRun={(val) => handleRunTool(tool.key, val)}
            />
          ))}
        </div>

        {/* Right Side: Active Research Output & Knowledge History */}
        <div className="space-y-4">
          {loading && (
            <Card className="border-primary/40 bg-primary/5 shadow-sm animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <CardTitle className="text-sm">جاري الفحص واستخراج الأدلة...</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  التحقق من صحة الكيان &ldquo;{currentQuery || pendingTool}&rdquo;، جمع مصادر الويب الحية، وصياغة التقرير الاستخباراتي.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {activeResearch && (
            <Card className="border-primary/30 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    {activeResearch.saved_to_memory !== false ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("savedBadge")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px] gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t("notSavedBadge")}
                      </Badge>
                    )}
                    <CardTitle className="text-base font-semibold leading-tight pt-1">
                      {activeResearch.title}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setActiveResearch(null)}
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Auto-Corrected Typo Callout */}
                {activeResearch.details?.verification_status === "typo_corrected" && activeResearch.details?.corrected_from && (
                  <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>
                      {t("typoCorrected", {
                        from: String(activeResearch.details.corrected_from),
                        to: activeResearch.details.subject ? String(activeResearch.details.subject) : activeResearch.query,
                      })}
                    </span>
                  </div>
                )}

                {/* Structure notice: the backend reports sections it could not
                    enforce, so an incomplete report is visible instead of silently
                    looking like the previous, differently-shaped one. */}
                {Array.isArray(activeResearch.details?.structure_warnings) &&
                  (activeResearch.details.structure_warnings as string[]).length > 0 && (
                    <div
                      role="status"
                      className="rounded-md bg-sky-500/10 border border-sky-500/20 px-3 py-2 text-xs text-sky-700 dark:text-sky-400 flex items-start gap-2"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-sky-500" />
                      <span>
                        {t("structureWarning", {
                          sections: (activeResearch.details.structure_warnings as string[]).join("، "),
                        })}
                      </span>
                    </div>
                  )}

                {/* Structured Markdown Report */}
                <div className="rounded-lg bg-muted/40 p-4 text-xs max-h-[500px] overflow-y-auto border">
                  <MarkdownReport content={activeResearch.summary} />
                </div>

                {/* Verified Web Sources Cards */}
                {Array.isArray(activeResearch.details?.sources) && (activeResearch.details.sources as SourceItem[]).length > 0 && (
                  <div className="rounded-lg border bg-background/80 p-3 space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Globe2 className="h-3.5 w-3.5 text-primary" />
                      {t("sourcesHeading")} ({(activeResearch.details.sources as SourceItem[]).length}):
                    </span>
                    <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                      {(activeResearch.details.sources as SourceItem[]).map((s, idx) => (
                        <a
                          key={idx}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-muted text-[11px] text-foreground hover:text-primary transition-colors group"
                        >
                          <span className="truncate group-hover:underline">{s.title || s.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                  <span className="flex items-center gap-1 font-medium text-primary">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    {activeResearch.saved_to_memory !== false ? t("availableToAgents") : t("ignoredFromMemory")}
                  </span>
                  <span>{activeResearch.created_at ? new Date(activeResearch.created_at).toLocaleTimeString() : ""}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved Research Intelligence History */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t("historyTitle")}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {recentItems.length}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {t("historyDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentItems.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  {t("historyEmpty")}
                </div>
              ) : (
                <ul className="divide-y max-h-[420px] overflow-y-auto">
                  {recentItems.map((item) => (
                    <li
                      key={item.id}
                      onClick={() => setActiveResearch(item)}
                      className="py-2.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[11px] text-muted-foreground/80 mt-1">
                        {cleanClientText(item.summary).replace(/[#*•>]/g, "").slice(0, 110)}...
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  isPending,
  isAnyBusy,
  onRun,
}: {
  tool: (typeof TOOLS)[number];
  isPending: boolean;
  isAnyBusy: boolean;
  onRun: (value: string) => void;
}) {
  const t = useTranslations("research");
  const [value, setValue] = useState("");
  const disabled = isAnyBusy || (tool.required && !value.trim());
  // The labels live in the message catalogue (messages/{en,ar}.json) keyed by the
  // same tool key the backend expects. They used to be hard-coded English, so an
  // Arabic workspace still saw "Website analyzer" and typed English placeholders.
  const title = t(`tools.${tool.key}.title`);
  const description = t(`tools.${tool.key}.desc`);
  const placeholder = t.has(`tools.${tool.key}.placeholder`) ? t(`tools.${tool.key}.placeholder`) : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    onRun(value.trim());
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            <tool.icon className="h-4 w-4" />
          </span>
          <CardTitle className="text-sm truncate">{title}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="mt-auto">
        <form onSubmit={submit} className="flex gap-2">
          {tool.field && (
            <Input
              type={tool.type ?? "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder ?? undefined}
              aria-label={title}
              className="h-9 text-xs"
              dir="auto"
              disabled={isPending}
            />
          )}
          <Button 
            type="submit" 
            size="sm" 
            className={`h-9 shrink-0 ${!tool.field ? "w-full justify-center" : ""}`} 
            disabled={disabled}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            )}
            <span className="ms-1.5">{t("run")}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

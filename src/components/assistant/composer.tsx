import {
  useState,
  useRef,
  useMemo,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Compass, Crosshair, Globe, ImagePlus, Loader2, MessageSquare, Palette, Sparkles, Square, Star, Wand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreativeReferences, useMemoryItems, useUploadChatAttachment } from "@/hooks/use-api";
import { useAssistantStore } from "@/store/assistant-store";
import { ContextChips } from "./context-chips";

interface MentionItem {
  type: "competitor" | "tool" | "reference";
  id: string;
  name: string;
  desc: string;
  icon: typeof Crosshair;
}

const TOOLS_MENTIONS: MentionItem[] = [
  {
    type: "tool",
    id: "tool_web_analyzer",
    name: "web_analyzer",
    desc: "فحص الموقع، الأسعار، العروض والـ CTAs",
    icon: Globe,
  },
  {
    type: "tool",
    id: "tool_reviews",
    name: "reviews",
    desc: "تقييمات العملاء ومشاعرهم الإيجابية والسلبية",
    icon: Star,
  },
  {
    type: "tool",
    id: "tool_gap_analysis",
    name: "gap_analysis",
    desc: "تحليل فجوات السوق والفرص غير المخدومة",
    icon: Sparkles,
  },
  {
    type: "tool",
    id: "tool_researcher",
    name: "researcher",
    desc: "نور: بحث استخباراتي معمق عن المنافسين",
    icon: Compass,
  },
];

const MAX_REFERENCE_BYTES = 2_000_000;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type CreativeMode = "chat" | "prompt" | "design";

const MODES: { id: CreativeMode; icon: typeof MessageSquare }[] = [
  { id: "chat", icon: MessageSquare },
  { id: "prompt", icon: Wand },
  { id: "design", icon: Palette },
];

export function Composer({
  onSend,
  onStop,
  disabled,
  mode,
  onModeChange,
  toolbar,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  mode: CreativeMode;
  onModeChange: (mode: CreativeMode) => void;
  /** Extra control rendered in the same row as the mode picker (the "talking to" selector). */
  toolbar?: ReactNode;
}) {
  const t = useTranslations("assistant");
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSubmitTimeRef = useRef(0);
  const addContext = useAssistantStore((s) => s.addContext);

  // Mention State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const memoryItems = useMemoryItems({ kind: "competitor_note" });
  const savedReferences = useCreativeReferences();

  const competitors = useMemo<MentionItem[]>(() => {
    const items = memoryItems.data?.items ?? [];
    const seen = new Set<string>();
    const list: MentionItem[] = [];
    for (const item of items) {
      const meta = (item.metadata || {}) as Record<string, unknown>;
      const details = (meta.details || {}) as Record<string, unknown>;
      const name = (details.subject as string) || (meta.query as string) || (item.text.length < 35 ? item.text : "");
      const cleanName = typeof name === "string" ? name.trim() : "";
      if (cleanName && !seen.has(cleanName.toLowerCase())) {
        seen.add(cleanName.toLowerCase());
        list.push({
          type: "competitor",
          id: item.id,
          name: cleanName,
          desc: t("mentionCompetitorDesc"),
          icon: Crosshair,
        });
      }
    }
    return list;
  }, [memoryItems.data, t]);

  /**
   * Analyzed references the user saved from the Creatives tab.
   *
   * These are the "@" targets that hand Layla a picture to work from. Mentioning
   * one attaches it as a reference chip; it never re-runs the analysis (the
   * analysis already happened when the user pressed "Start" in the library).
   */
  const references = useMemo<MentionItem[]>(
    () =>
      (savedReferences.data ?? []).map((reference) => ({
        type: "reference" as const,
        id: reference.id,
        name: reference.sourceName,
        desc: reference.summary || t("mentionReferenceDesc"),
        icon: ImagePlus,
      })),
    [savedReferences.data, t],
  );

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const matchedReferences = references.filter((r) => r.name.toLowerCase().includes(q));
    const matchedCompetitors = competitors.filter((c) => c.name.toLowerCase().includes(q));
    const matchedTools = TOOLS_MENTIONS.filter((tool) => tool.name.toLowerCase().includes(q) || tool.desc.toLowerCase().includes(q));
    return [...matchedReferences, ...matchedCompetitors, ...matchedTools];
  }, [mentionQuery, competitors, references]);

  const handleSelectMention = (item: MentionItem) => {
    if (!textareaRef.current) return;
    const text = value;
    const cursorPos = textareaRef.current.selectionStart || text.length;
    const textBefore = text.slice(0, cursorPos);
    const textAfter = text.slice(cursorPos);
    const lastAtPos = textBefore.lastIndexOf("@");
    if (lastAtPos === -1) return;

    const mentionText = `@${item.name} `;
    const newText = textBefore.slice(0, lastAtPos) + mentionText + textAfter;
    setValue(newText);
    setMentionQuery(null);
    setMentionIndex(0);

    // Competitors and analyzed references both become explicit context chips so
    // the backend receives a stable id instead of having to re-parse the text.
    if (item.type === "competitor") {
      addContext({ kind: "competitor", id: item.id, label: item.name });
    } else if (item.type === "reference") {
      addContext({ kind: "reference", id: item.id, label: item.name });
    }

    // Set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursor = lastAtPos + mentionText.length;
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);
    const cursorPos = e.target.selectionStart || 0;
    const textBefore = val.slice(0, cursorPos);
    const match = textBefore.match(/@([^\s@]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const [uploadError, setUploadError] = useState("");
  const [attachmentStatus, setAttachmentStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadChatAttachment();

  /**
   * Attach a photo to the next message.
   *
   * This is intentionally *not* `analyzeReference`: uploading a picture must not
   * run the photo-analysis tool, must not switch the composer to a creative
   * mode, and must not move the user to another tab. The image simply travels
   * with the message and the selected model sees it (or says it cannot).
   */
  const attachImage = (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    setAttachmentStatus("");
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError(t("referenceUnsupported"));
      return;
    }
    if (file.size > MAX_REFERENCE_BYTES) {
      setUploadError(t("referenceTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const stored = await upload.mutateAsync({
          source: String(reader.result ?? ""),
          fileName: file.name,
          mime: file.type,
        });
        addContext({ kind: "attachment", id: stored.id, label: stored.name || file.name });
        setAttachmentStatus(t("attachmentReady"));
      } catch {
        setUploadError(t("attachmentUploadFailed"));
      }
    };
    reader.onerror = () => setUploadError(t("attachmentUploadFailed"));
    reader.readAsDataURL(file);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const text = value.trim();
    const now = Date.now();
    // Only the upload itself blocks sending; an in-flight analysis no longer does,
    // because there is no analysis on attach any more.
    if (!text || disabled || upload.isPending || now - lastSubmitTimeRef.current < 600) return;
    lastSubmitTimeRef.current = now;
    setValue("");
    setMentionQuery(null);
    setAttachmentStatus("");
    onSend(text);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="relative space-y-2 rounded-lg border bg-card p-3">
      {mentionQuery !== null && filteredMentions.length > 0 && (
        <div className="absolute bottom-full start-3 mb-2 w-72 sm:w-80 max-h-56 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg z-50 animate-in fade-in-50 slide-in-from-bottom-2">
          <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {t("mentionTitle")}
          </div>
          <div className="space-y-0.5">
            {filteredMentions.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === mentionIndex;
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectMention(item);
                  }}
                  onMouseEnter={() => setMentionIndex(idx)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-start transition-colors ${
                    isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted/60"
                  }`}
                >
                  <div className={`p-1 rounded ${
                    item.type === "competitor"
                      ? "bg-rose-500/10 text-rose-500"
                      : item.type === "reference"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-primary/10 text-primary"
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">@{item.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <ContextChips />
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label={t("modeGroup")}
          className="flex flex-wrap gap-1.5"
        >
          {MODES.map(({ id, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={mode === id ? "default" : "outline"}
              role="radio"
              aria-checked={mode === id}
              onClick={() => onModeChange(id)}
              title={t(`mode.${id}.hint`)}
              className="gap-1.5"
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`mode.${id}.label`)}
            </Button>
          ))}
        </div>
        {toolbar && <div className="ms-auto flex items-center gap-2">{toolbar}</div>}
      </div>
      <p className="text-xs text-muted-foreground">{t(`mode.${mode}.hint`)}</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          attachImage(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || upload.isPending}
          onClick={() => fileRef.current?.click()}
          aria-label={t("attachImage")}
          title={t("attachImage")}
        >
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </Button>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={onKey}
          placeholder={t("placeholder")}
          rows={2}
          className="min-h-[44px] resize-none"
          aria-label={t("placeholder")}
          disabled={disabled}
        />
        {disabled ? (
          <Button type="button" variant="outline" size="icon" onClick={onStop} aria-label={t("stop")}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!value.trim() || disabled || upload.isPending} aria-label={t("send")}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      {upload.isPending && <p className="text-xs text-muted-foreground" role="status">{t("uploadingAttachment")}</p>}
      {attachmentStatus && <p className="text-xs text-emerald-700 dark:text-emerald-400" role="status">{attachmentStatus}</p>}
      {uploadError && <p className="text-xs text-destructive" role="alert">{uploadError}</p>}
    </form>
  );
}

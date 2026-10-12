"use client";

import { useState, useRef, useMemo, type FormEvent, type KeyboardEvent, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Compass, Crosshair, Globe, Sparkles, Square, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContextChips } from "./context-chips";
import { useMemoryItems } from "@/hooks/use-api";
import { useAssistantStore } from "@/store/assistant-store";

interface MentionItem {
  type: "competitor" | "tool";
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

export function Composer({ onSend, onStop, disabled }: { onSend: (text: string) => void; onStop: () => void; disabled: boolean }) {
  const t = useTranslations("assistant");
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSubmitTimeRef = useRef(0);
  const addContext = useAssistantStore((s) => s.addContext);

  // Mention State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const memoryItems = useMemoryItems({ kind: "competitor_note" });

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
          desc: "منافس مسجل في الذاكرة",
          icon: Crosshair,
        });
      }
    }
    return list;
  }, [memoryItems.data]);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const matchedCompetitors = competitors.filter((c) => c.name.toLowerCase().includes(q));
    const matchedTools = TOOLS_MENTIONS.filter((tool) => tool.name.toLowerCase().includes(q) || tool.desc.toLowerCase().includes(q));
    return [...matchedCompetitors, ...matchedTools];
  }, [mentionQuery, competitors]);

  const handleSelectMention = (item: MentionItem) => {
    if (!textareaRef.current) return;
    const text = value;
    const cursorPos = textareaRef.current.selectionStart || text.length;
    const textBefore = text.slice(0, cursorPos);
    const textAfter = text.slice(cursorPos);
    const lastAtPos = textBefore.lastIndexOf("@");
    if (lastAtPos === -1) return;

    const mentionText = item.type === "competitor" ? `@${item.name} ` : `@${item.name} `;
    const newText = textBefore.slice(0, lastAtPos) + mentionText + textAfter;
    setValue(newText);
    setMentionQuery(null);
    setMentionIndex(0);

    // If a competitor was mentioned, attach it as context chip for explicit context
    if (item.type === "competitor") {
      addContext({ kind: "competitor", id: item.id, label: item.name });
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

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const text = value.trim();
    const now = Date.now();
    if (!text || disabled || now - lastSubmitTimeRef.current < 600) return;
    lastSubmitTimeRef.current = now;
    setValue("");
    setMentionQuery(null);
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
            المنافسين والأدوات (@ Mention)
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
                  <div className={`p-1 rounded ${item.type === "competitor" ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"}`}>
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
      <div className="flex items-end gap-2">
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
          <Button type="submit" size="icon" disabled={!value.trim() || disabled} aria-label={t("send")}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

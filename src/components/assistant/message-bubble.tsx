"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message, QuestionWithOptionsBlock } from "@/types";
import { BlockRenderer, renderMarkdown, type BlockContext } from "./blocks";

export function MessageBubble({ message, ctx }: { message: Message; ctx: Omit<BlockContext, "messageId"> }) {
  const t = useTranslations("assistant");
  const isUser = message.role === "user";

  // Identify all question_with_options blocks in this message
  const questionBlockIndices: number[] = [];
  message.blocks.forEach((b, idx) => {
    if (typeof b === "object" && b !== null && "type" in b && b.type === "question_with_options") {
      questionBlockIndices.push(idx);
    }
  });

  const hasMultipleQuestions = questionBlockIndices.length > 1;
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleToggle = (blockIdx: number, optId: string, isMulti: boolean) => {
    if (isSubmitted) return;
    setSelections((prev) => {
      const current = prev[blockIdx] ?? [];
      const next = isMulti
        ? current.includes(optId)
          ? current.filter((x) => x !== optId)
          : [...current, optId]
        : current.includes(optId)
          ? []
          : [optId];
      return { ...prev, [blockIdx]: next };
    });
  };

  const answeredCount = questionBlockIndices.filter(
    (idx) => (selections[idx]?.length ?? 0) > 0
  ).length;

  const handleSubmitAll = () => {
    if (answeredCount === 0 || ctx.isStreaming) return;
    setIsSubmitted(true);

    const formatted: string[] = [];
    const allOptionIds: string[] = [];

    questionBlockIndices.forEach((blockIdx) => {
      const qBlock = message.blocks[blockIdx] as QuestionWithOptionsBlock;
      const chosenIds = selections[blockIdx] ?? [];
      if (chosenIds.length > 0) {
        allOptionIds.push(...chosenIds);
        const chosenLabels = (qBlock.options || [])
          .filter((o) => chosenIds.includes(o.id))
          .map((o) => o.label)
          .join(", ");
        formatted.push(`• **${qBlock.question}**\n  ${chosenLabels}`);
      }
    });

    const combinedText = formatted.join("\n\n");
    ctx.onAnswer?.(message.id, allOptionIds, combinedText);
  };

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(isUser ? "bg-muted" : "bg-primary text-primary-foreground")}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-2", isUser && "items-end")}>
        <span className="text-xs text-muted-foreground">{isUser ? t("you") : t("ai")}</span>
        {message.context.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.context.map((c) => (
              <Badge key={`${c.kind}-${c.id}`} variant="secondary" className="text-[11px]">
                {c.label}
              </Badge>
            ))}
          </div>
        )}
        <div className={cn("flex w-full flex-col gap-3", isUser && "rounded-2xl rounded-se-sm bg-primary px-4 py-2 text-primary-foreground")}>
          {message.blocks && message.blocks.length > 0 ? (
            message.blocks.map((b, i) => {
              const isQuestion = typeof b === "object" && b !== null && "type" in b && b.type === "question_with_options";
              const qOrder = isQuestion ? questionBlockIndices.indexOf(i) + 1 : undefined;
              const qProps = hasMultipleQuestions && isQuestion
                ? {
                    controlledSelected: selections[i] ?? [],
                    onControlledToggle: (optId: string) => {
                      const qb = b as QuestionWithOptionsBlock;
                      const isMulti = qb.multiSelect !== false && qb.multi_select !== false;
                      handleToggle(i, optId, isMulti);
                    },
                    hideSubmit: true,
                    questionNumber: qOrder,
                    totalQuestions: questionBlockIndices.length,
                    isParentSubmitted: isSubmitted,
                  }
                : undefined;

              return (
                <BlockRenderer
                  key={i}
                  block={b}
                  ctx={{ ...ctx, messageId: message.id }}
                  questionProps={qProps}
                />
              );
            })
          ) : (
            <div className="space-y-2 text-sm leading-relaxed">
              {renderMarkdown(message.content || "")}
            </div>
          )}

          {hasMultipleQuestions && !isSubmitted && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {answeredCount === questionBlockIndices.length
                    ? "All questions answered"
                    : `${answeredCount} of ${questionBlockIndices.length} questions answered`}
                </span>
                {answeredCount < questionBlockIndices.length && (
                  <span className="block text-[11px] text-muted-foreground">
                    Select your options and submit together
                  </span>
                )}
              </div>
              <Button
                size="sm"
                disabled={answeredCount === 0 || ctx.isStreaming}
                onClick={handleSubmitAll}
                className="shrink-0"
              >
                Submit Answers
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

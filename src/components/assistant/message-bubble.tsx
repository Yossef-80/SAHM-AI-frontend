"use client";

import { useTranslations } from "next-intl";
import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import { BlockRenderer, type BlockContext } from "./blocks";

export function MessageBubble({ message, ctx }: { message: Message; ctx: Omit<BlockContext, "messageId"> }) {
  const t = useTranslations("assistant");
  const isUser = message.role === "user";
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
          {message.blocks.map((b, i) => (
            <BlockRenderer key={i} block={b} ctx={{ ...ctx, messageId: message.id }} />
          ))}
        </div>
      </div>
    </div>
  );
}

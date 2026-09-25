"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary, CardGridSkeleton } from "@/components/shared/async-boundary";
import { useAction } from "@/hooks/use-action";
import { useAgents } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";
import { AgentEditorSheet } from "./agent-editor-sheet";

export function AgentsView() {
  const t = useTranslations("agents");
  const q = useAgents();
  const [editing, setEditing] = useState<Agent | null>(null);

  return (
    <div>
      <PageHeader title={t("title")} description={t("desc")} />
      <AsyncBoundary {...q} onRetry={() => q.refetch()} skeleton={<CardGridSkeleton />}>
        {(agents) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={a.id} agent={a} onEdit={() => setEditing(a)} />
            ))}
          </div>
        )}
      </AsyncBoundary>
      <AgentEditorSheet agent={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function AgentCard({ agent, onEdit }: { agent: Agent; onEdit: () => void }) {
  const t = useTranslations("agents");
  const { dispatch, pending } = useAction();
  return (
    <Card className={cn("flex flex-col", !agent.enabled && "opacity-70")}>
      <CardHeader className="flex-row items-start gap-3 space-y-0 pb-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl" aria-hidden>
          {agent.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{agent.name}</h3>
            <Badge variant="outline">{t(`role.${agent.role}`)}</Badge>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
        </div>
        <Switch
          checked={agent.enabled}
          disabled={pending === "UPDATE_AGENT"}
          aria-label={agent.enabled ? t("enabled") : t("disabled")}
          onCheckedChange={(enabled) => dispatch({ type: "UPDATE_AGENT", payload: { id: agent.id, patch: { enabled } } })}
        />
      </CardHeader>
      <CardContent className="mt-auto space-y-3 text-xs">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{t(`tone.${agent.persona.tone}`)}</Badge>
          <Badge variant="secondary">{t(`autonomyLevels.${agent.autonomy}.label`)}</Badge>
          <Badge variant="secondary">{agent.persona.language.toUpperCase()}</Badge>
        </div>
        <div>
          <p className="mb-1 text-muted-foreground">{t("tools")}</p>
          <div className="flex flex-wrap gap-1">
            {agent.allowedTools.map((tool) => (
              <span key={tool} className="rounded border px-1.5 py-0.5">
                {t(`toolNames.${tool}`)}
              </span>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={onEdit}>
          <Pencil className="me-2 h-3.5 w-3.5" />
          {t("edit")}
        </Button>
      </CardContent>
    </Card>
  );
}

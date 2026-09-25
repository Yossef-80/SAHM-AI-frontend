"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ActionButton } from "@/components/shared/action-button";
import { cn } from "@/lib/utils";
import { AgentAutonomySchema, AgentToneSchema, type Agent, type AgentAutonomy, type AgentTone, type AgentTool, type Locale } from "@/types";

interface Props {
  agent: Agent | null;
  onClose: () => void;
}

/** Persona editor. Saving dispatches UPDATE_AGENT through the registry. */
export function AgentEditorSheet({ agent, onClose }: Props) {
  const t = useTranslations("agents");
  const tc = useTranslations("common");
  const [form, setForm] = useState({
    name: "",
    emoji: "",
    tone: "professional" as AgentTone,
    language: "en" as Locale,
    instructions: "",
    autonomy: "suggest" as AgentAutonomy,
    allowedTools: [] as AgentTool[],
    enabled: true,
  });

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        emoji: agent.emoji,
        tone: agent.persona.tone,
        language: agent.persona.language,
        instructions: agent.persona.instructions,
        autonomy: agent.autonomy,
        allowedTools: agent.allowedTools,
        enabled: agent.enabled,
      });
    }
  }, [agent]);

  const toggleTool = (tool: AgentTool) =>
    setForm((f) => ({ ...f, allowedTools: f.allowedTools.includes(tool) ? f.allowedTools.filter((x) => x !== tool) : [...f.allowedTools, tool] }));

  const valid = form.name.trim().length > 0 && form.emoji.trim().length > 0 && form.instructions.length <= 2000;

  return (
    <Sheet open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-start">{agent ? `${agent.emoji} ${agent.name}` : ""}</SheetTitle>
        </SheetHeader>
        {agent && (
          <div className="mt-4 flex flex-1 flex-col gap-5">
            <div className="grid grid-cols-[1fr_88px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ag-name">{t("editor.name")}</Label>
                <Input id="ag-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="auto" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ag-emoji">{t("editor.emoji")}</Label>
                <Input id="ag-emoji" value={form.emoji} maxLength={4} className="text-center text-lg" onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("editor.toneLabel")}</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v as AgentTone })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AgentToneSchema.options.map((tone) => <SelectItem key={tone} value={tone}>{t(`tone.${tone}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("editor.language")}</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v as Locale })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ag-instr">{t("editor.instructions")}</Label>
              <Textarea id="ag-instr" rows={5} value={form.instructions} maxLength={2000} placeholder={t("editor.instructionsPlaceholder")} onChange={(e) => setForm({ ...form, instructions: e.target.value })} dir="auto" />
              <p className="text-xs text-muted-foreground">
                {t("editor.instructionsHelp")} ({form.instructions.length}/2000)
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("editor.autonomy")}</Label>
              <div className="grid gap-2">
                {AgentAutonomySchema.options.map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={form.autonomy === level}
                    onClick={() => setForm({ ...form, autonomy: level })}
                    className={cn("rounded-md border p-2.5 text-start text-sm transition", form.autonomy === level ? "border-primary bg-primary/5" : "hover:bg-muted/50")}
                  >
                    <p className="font-medium">{t(`autonomyLevels.${level}.label`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`autonomyLevels.${level}.desc`)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("editor.tools")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {agent.availableTools.map((tool) => {
                  const on = form.allowedTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTool(tool)}
                      className={cn("rounded-md border px-2.5 py-1 text-xs transition", on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground opacity-70")}
                    >
                      {t(`toolNames.${tool}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="ag-enabled">{form.enabled ? t("enabled") : t("disabled")}</Label>
              <Switch id="ag-enabled" checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} />
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("editor.preview")}</p>
              <p dir="auto">
                {form.emoji} {t("editor.previewText", { name: form.name, role: t(`role.${agent.role}`), instructions: form.instructions.slice(0, 140) })}
              </p>
            </div>

            <div className="mt-auto flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
              <ActionButton
                className="flex-1"
                disabled={!valid}
                showIcon={false}
                onDone={(ok) => ok && onClose()}
                action={{
                  type: "UPDATE_AGENT",
                  payload: {
                    id: agent.id,
                    patch: {
                      name: form.name.trim(),
                      emoji: form.emoji.trim(),
                      persona: { tone: form.tone, language: form.language, instructions: form.instructions, signOff: agent.persona.signOff },
                      allowedTools: form.allowedTools,
                      autonomy: form.autonomy,
                      enabled: form.enabled,
                    },
                  },
                }}
              >
                {tc("save")}
              </ActionButton>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

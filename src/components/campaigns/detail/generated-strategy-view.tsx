"use client";

import { useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { GeneratedCampaignStrategy } from "@/types";

export function GeneratedStrategyView({ strategy }: { strategy: GeneratedCampaignStrategy }) {
  const locale = useLocale();
  const ar = locale === "ar";
  const labels = ar
    ? {
        summary: "الخلاصة",
        objective: "الهدف",
        audience: "الجمهور المستهدف",
        positioning: "التموضع",
        messages: "الرسائل الأساسية",
        channels: "القنوات المقترحة",
        placements: "أماكن الظهور",
        creative: "التوجه الإبداعي",
        cta: "الدعوة إلى الإجراء",
        needed: "المواد الإبداعية المطلوبة",
        metrics: "مؤشرات النجاح",
        evidence: "الشواهد",
        assumptions: "افتراضات تحتاج تأكيدًا",
        missing: "معلومات مطلوبة قبل الاعتماد",
        draft: "هذه مسودة استراتيجية فقط؛ لا تنشئ حملة أو إعلانًا ولا تنشر شيئًا على Meta.",
        share: "حصة مقترحة",
      }
    : {
        summary: "Summary",
        objective: "Objective",
        audience: "Target audience",
        positioning: "Positioning",
        messages: "Key messages",
        channels: "Suggested channels",
        placements: "Placements",
        creative: "Creative direction",
        cta: "Call to action",
        needed: "Creative assets needed",
        metrics: "Success metrics",
        evidence: "Evidence",
        assumptions: "Assumptions to confirm",
        missing: "Needed before approval",
        draft: "Strategy draft only; this does not create or publish anything on Meta.",
        share: "Suggested share",
      };

  return (
    <div className="space-y-3">
      <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        {labels.draft}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Section title={labels.summary} className="md:col-span-2">
          <p>{strategy.summary}</p>
        </Section>
        {strategy.objective && <Section title={labels.objective}><p>{strategy.objective}</p></Section>}
        {strategy.audience && <Section title={labels.audience}><p>{strategy.audience}</p></Section>}
        {strategy.positioning && <Section title={labels.positioning}><p>{strategy.positioning}</p></Section>}
        {strategy.keyMessages.length > 0 && (
          <Section title={labels.messages}>
            <ul className="list-inside list-disc space-y-1">
              {strategy.keyMessages.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
            </ul>
          </Section>
        )}
        {strategy.channels.length > 0 && (
          <Section title={labels.channels}>
            <div className="space-y-3">
              {strategy.channels.map((channel, index) => (
                <div key={`${index}-${channel.channel}`} className="rounded-md border p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{channel.channel}</Badge>
                    {channel.budgetSharePct != null && (
                      <Badge variant="outline">{labels.share}: {channel.budgetSharePct}%</Badge>
                    )}
                  </div>
                  {channel.role && <p className="mt-1.5 text-xs">{channel.role}</p>}
                  {channel.placements.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {labels.placements}: {channel.placements.join(", ")}
                    </p>
                  )}
                  {channel.rationale && <p className="mt-1 text-xs text-muted-foreground">{channel.rationale}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}
        {strategy.placements.length > 0 && (
          <Section title={labels.placements}>
            <div className="flex flex-wrap gap-1">
              {strategy.placements.map((placement) => <Badge key={placement} variant="outline">{placement}</Badge>)}
            </div>
          </Section>
        )}
        {strategy.creativeDirection && <Section title={labels.creative}><p>{strategy.creativeDirection}</p></Section>}
        {strategy.ctaDirection && <Section title={labels.cta}><p>{strategy.ctaDirection}</p></Section>}
        {strategy.creativesNeeded.length > 0 && <ListSection title={labels.needed} items={strategy.creativesNeeded} />}
        {strategy.successMetrics.length > 0 && <ListSection title={labels.metrics} items={strategy.successMetrics} />}
        {strategy.evidence.length > 0 && <ListSection title={labels.evidence} items={strategy.evidence} />}
        {strategy.assumptions.length > 0 && <ListSection title={labels.assumptions} items={strategy.assumptions} />}
        {strategy.missingInputs.length > 0 && (
          <Section title={labels.missing} className="md:col-span-2">
            <ul className="list-inside list-disc space-y-1 text-amber-700 dark:text-amber-400">
              {strategy.missingInputs.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <Section title={title}>
      <ul className="list-inside list-disc space-y-1">
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    </Section>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border p-3 text-sm ${className ?? ""}`}>
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

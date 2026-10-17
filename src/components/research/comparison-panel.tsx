"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Renders the structured payload from `POST /research/compare`.
 *
 * The endpoint is strict about shape, but this component still parses
 * defensively: a stored comparison from an older run, or one edited in memory,
 * must degrade to "show what is there" rather than crash the Research page.
 */

type Verdict = "a_leads" | "b_leads" | "parity";

interface Dimension {
  dimension?: string;
  competitor_a?: string;
  competitor_b?: string;
  verdict?: Verdict;
  evidence?: string[];
}

interface Gap {
  title?: string;
  why_it_matters?: string;
  who_has_it?: "a" | "b" | "both" | "neither";
  evidence?: string[];
  confidence?: "high" | "medium" | "low";
}

interface Opportunity {
  title?: string;
  rationale?: string;
  effort?: "low" | "medium" | "high";
  impact?: "low" | "medium" | "high";
  first_step?: string;
  evidence?: string[];
}

export interface ComparisonPayload {
  summary?: string;
  dimensions?: Dimension[];
  gaps?: Gap[];
  opportunities?: Opportunity[];
  recommended_focus?: string[];
}

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export function ComparisonPanel({
  comparison,
  competitorA,
  competitorB,
}: {
  comparison: ComparisonPayload;
  competitorA: string;
  competitorB: string;
}) {
  const t = useTranslations("research");
  const dimensions = asArray<Dimension>(comparison.dimensions);
  const gaps = asArray<Gap>(comparison.gaps);
  const opportunities = asArray<Opportunity>(comparison.opportunities);
  const focus = asArray<string>(comparison.recommended_focus).filter(Boolean);

  const verdictLabel = (verdict?: Verdict) => {
    if (verdict === "a_leads") return t("compareVerdictA", { name: competitorA });
    if (verdict === "b_leads") return t("compareVerdictB", { name: competitorB });
    return t("compareVerdictParity");
  };

  const whoLabel = (who?: Gap["who_has_it"]) => {
    if (who === "a") return competitorA;
    if (who === "b") return competitorB;
    if (who === "both") return t("compareWhoBoth");
    return t("compareWhoNeither");
  };

  const effortTone = (value?: string) =>
    value === "high"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : value === "medium"
        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";

  return (
    <div className="space-y-4">
      {comparison.summary ? (
        <div className="rounded-lg border bg-background/70 p-3 text-xs leading-relaxed">
          {comparison.summary}
        </div>
      ) : null}

      {dimensions.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="h-3.5 w-3.5 text-primary" />
            {t("compareDimensions")}
          </h4>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-muted/50 text-start">
                  <th className="p-2 text-start font-medium">{t("compareDimension")}</th>
                  <th className="p-2 text-start font-medium">{competitorA}</th>
                  <th className="p-2 text-start font-medium">{competitorB}</th>
                  <th className="p-2 text-start font-medium">{t("compareVerdict")}</th>
                </tr>
              </thead>
              <tbody>
                {dimensions.map((dim, index) => (
                  <tr key={`${dim.dimension ?? "dim"}-${index}`} className="border-t align-top">
                    <td className="p-2 font-medium">{dim.dimension ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{dim.competitor_a || "—"}</td>
                    <td className="p-2 text-muted-foreground">{dim.competitor_b || "—"}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="whitespace-nowrap text-[10px]">
                        {verdictLabel(dim.verdict)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {gaps.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            {t("compareGaps")}
          </h4>
          <ul className="space-y-2">
            {gaps.map((gap, index) => (
              <li key={`${gap.title ?? "gap"}-${index}`} className="rounded-lg border p-2.5 text-[11px]">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{gap.title ?? t("compareUntitled")}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {whoLabel(gap.who_has_it)}
                    </Badge>
                    {gap.confidence ? (
                      <Badge variant="outline" className="text-[10px]">
                        {t(`compareConfidence_${gap.confidence}`)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {gap.why_it_matters ? (
                  <p className="mt-1 text-muted-foreground">{gap.why_it_matters}</p>
                ) : null}
                {asArray<string>(gap.evidence).length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground/80">
                    {asArray<string>(gap.evidence).slice(0, 3).map((item, i) => (
                      <li key={i}>· {item}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {opportunities.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            {t("compareOpportunities")}
          </h4>
          <ul className="space-y-2">
            {opportunities.map((opp, index) => (
              <li key={`${opp.title ?? "opp"}-${index}`} className="rounded-lg border p-2.5 text-[11px]">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{opp.title ?? t("compareUntitled")}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    {opp.impact ? (
                      <Badge variant="outline" className={`text-[10px] ${effortTone(opp.impact)}`}>
                        {t("compareImpactLabel")}: {t(`compareLevel_${opp.impact}`)}
                      </Badge>
                    ) : null}
                    {opp.effort ? (
                      <Badge variant="outline" className={`text-[10px] ${effortTone(opp.effort)}`}>
                        {t("compareEffortLabel")}: {t(`compareLevel_${opp.effort}`)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {opp.rationale ? <p className="mt-1 text-muted-foreground">{opp.rationale}</p> : null}
                {opp.first_step ? (
                  <p className="mt-1 flex items-start gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                    {opp.first_step}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {focus.length > 0 && (
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("compareFocus")}
          </h4>
          <ol className="list-inside list-decimal space-y-1 text-[11px]">
            {focus.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

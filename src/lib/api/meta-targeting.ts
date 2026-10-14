import type { AudienceTargetingTarget, TargetingCategory } from "@/types";

/** Detailed-targeting fields published in Meta's flexible-targeting spec. */
const META_FLEXIBLE_SPEC_FIELDS: Partial<Record<TargetingCategory, string>> = {
  interests: "interests",
  behaviors: "behaviors",
  job_titles: "work_positions",
  employers: "work_employers",
  education_majors: "education_majors",
  education_schools: "education_schools",
  life_events: "life_events",
  industries: "industries",
  income: "income",
  family_statuses: "family_statuses",
};

/** Meta's targeting spec defines these as top-level string-array fields. */
const META_TOP_LEVEL_TARGETING_FIELDS: Partial<Record<TargetingCategory, string>> = {
  devices: "user_device",
  operating_systems: "user_os",
};

/**
 * Convert only user-selected Meta results to the documented targeting shape.
 * Flexible categories preserve Meta's returned id/name pairs. Device and OS
 * values use their exact Meta-returned names because those fields are strings.
 */
export function buildMetaDetailedTargeting(
  targets: readonly AudienceTargetingTarget[],
): Record<string, unknown> {
  const flexibleSpec: Record<string, Array<{ id: string; name: string }>> = {};
  const topLevelTargeting: Record<string, string[]> = {};

  for (const target of targets) {
    const flexibleField = META_FLEXIBLE_SPEC_FIELDS[target.category];
    if (flexibleField) {
      (flexibleSpec[flexibleField] ??= []).push({ id: target.id, name: target.name });
      continue;
    }
    const topLevelField = META_TOP_LEVEL_TARGETING_FIELDS[target.category];
    if (topLevelField) (topLevelTargeting[topLevelField] ??= []).push(target.name);
  }

  return {
    ...(Object.keys(flexibleSpec).length > 0 ? { flexible_spec: [flexibleSpec] } : {}),
    ...topLevelTargeting,
  };
}

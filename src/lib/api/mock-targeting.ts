import type { MetaInterestSuggestion, TargetingCategory } from "@/types";

/**
 * Category-complete, local-only examples. The prefixed IDs are synthetic so a
 * demo result can never be mistaken for a live Meta targeting ID.
 */
const MOCK_TARGETING: Record<TargetingCategory, MetaInterestSuggestion[]> = {
  interests: [
    { id: "mock-interests-golf", name: "Golf", category: "interests", audienceSize: 41_200_000, description: "Golf-related interests", path: ["Sports", "Golf"] },
    { id: "mock-interests-cars", name: "Cars", category: "interests", audienceSize: 98_000_000, description: "Car-related interests", path: ["Vehicles", "Cars"] },
    { id: "mock-interests-auto-parts", name: "Auto Parts", category: "interests", audienceSize: 12_400_000, description: "Automotive parts", path: ["Vehicles", "Auto Parts"] },
  ],
  behaviors: [
    { id: "mock-behaviors-frequent-travelers", name: "Frequent travelers", category: "behaviors", audienceSize: null, description: "Behavior category returned by the mock catalog", path: ["Behaviors", "Travel"] },
  ],
  job_titles: [
    { id: "mock-job-titles-business-owner", name: "Business owner", category: "job_titles", audienceSize: null, description: "Job title category returned by the mock search", path: ["Demographics", "Work", "Job titles"] },
  ],
  employers: [
    { id: "mock-employers-example-company", name: "Example company", category: "employers", audienceSize: null, description: "Employer category returned by the mock search", path: ["Demographics", "Work", "Employers"] },
  ],
  education_majors: [
    { id: "mock-education-majors-marketing", name: "Marketing", category: "education_majors", audienceSize: null, description: "Education major category returned by the mock search", path: ["Demographics", "Education", "Majors"] },
  ],
  education_schools: [
    { id: "mock-education-schools-cairo-university", name: "Cairo University", category: "education_schools", audienceSize: null, description: "Education school category returned by the mock search", path: ["Demographics", "Education", "Schools"] },
  ],
  life_events: [
    { id: "mock-life-events-recently-moved", name: "Recently moved", category: "life_events", audienceSize: null, description: "Life event category returned by the mock catalog", path: ["Demographics", "Life events"] },
  ],
  industries: [
    { id: "mock-industries-food-beverage", name: "Food and beverage", category: "industries", audienceSize: null, description: "Industry category returned by the mock catalog", path: ["Demographics", "Industries"] },
  ],
  income: [
    { id: "mock-income-household-segment", name: "Household income segment", category: "income", audienceSize: null, description: "Income category returned by the mock catalog", path: ["Demographics", "Income"] },
  ],
  family_statuses: [
    { id: "mock-family-statuses-parent", name: "Parent", category: "family_statuses", audienceSize: null, description: "Family status category returned by the mock catalog", path: ["Demographics", "Family status"] },
  ],
  devices: [
    { id: "mock-devices-iphone", name: "iPhone", category: "devices", audienceSize: null, description: "Device value returned by the mock catalog", path: ["Device"] },
  ],
  operating_systems: [
    { id: "mock-operating-systems-ios", name: "iOS", category: "operating_systems", audienceSize: null, description: "Operating system value returned by the mock catalog", path: ["Operating system"] },
  ],
};

export function getMockMetaTargetingResults(
  query: string,
  category: TargetingCategory,
): MetaInterestSuggestion[] {
  const foldedQuery = query.trim().toLocaleLowerCase();
  if (!foldedQuery) return [];
  return MOCK_TARGETING[category].filter((result) =>
    `${result.name} ${result.description ?? ""} ${result.path.join(" ")}`
      .toLocaleLowerCase()
      .includes(foldedQuery),
  );
}

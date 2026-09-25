import type { Agent, ContentItem, ContentChannel, ContentFormat } from "@/types";

const now = () => new Date().toISOString();

export const agents: Agent[] = [
  {
    id: "agent_researcher",
    role: "researcher",
    name: "Nour",
    emoji: "🔍",
    description: "Scans the market, competitors, reviews and keywords. Produces findings with sources.",
    persona: { tone: "professional", language: "en", instructions: "Always cite where a finding came from. Prefer numbers over adjectives. Flag low-confidence claims explicitly.", signOff: undefined },
    allowedTools: ["search_web", "analyze_website", "analyze_competitor", "analyze_social_profile", "analyze_reviews", "analyze_market", "analyze_keywords", "analyze_competitor_creatives", "detect_market_gaps"],
    availableTools: ["search_web", "analyze_website", "analyze_competitor", "analyze_social_profile", "analyze_reviews", "analyze_market", "analyze_keywords", "analyze_competitor_creatives", "detect_market_gaps"],
    autonomy: "auto_draft",
    enabled: true,
    updatedAt: now(),
  },
  {
    id: "agent_strategist",
    role: "strategist",
    name: "Omar",
    emoji: "🧭",
    description: "Turns research and brand profile into marketing & campaign strategies and content calendars.",
    persona: { tone: "bold", language: "en", instructions: "Lead with one clear big idea. Every strategy needs phases, KPIs and a reason to believe.", signOff: undefined },
    allowedTools: ["generate_marketing_strategy", "generate_campaign_strategy", "generate_content_calendar"],
    availableTools: ["generate_marketing_strategy", "generate_campaign_strategy", "generate_content_calendar", "search_web"],
    autonomy: "suggest",
    enabled: true,
    updatedAt: now(),
  },
  {
    id: "agent_creative",
    role: "creative",
    name: "Layla",
    emoji: "🎨",
    description: "Writes briefs, scripts, ad copy and image/video prompts in the brand voice.",
    persona: { tone: "playful", language: "en", instructions: "Warm, confident, a little cheeky. Never use the words on the brand's do-not-use list. Hooks in the first 2 seconds.", signOff: undefined },
    allowedTools: ["generate_creative_brief", "generate_commercial_script", "generate_image_prompt", "generate_video_prompt", "generate_ad_copy", "generate_ad_variations"],
    availableTools: ["generate_creative_brief", "generate_commercial_script", "generate_image_prompt", "generate_video_prompt", "generate_ad_copy", "generate_ad_variations"],
    autonomy: "auto_draft",
    enabled: true,
    updatedAt: now(),
  },
  {
    id: "agent_analyst",
    role: "analyst",
    name: "Karim",
    emoji: "📊",
    description: "Reads Meta performance data and explains what happened and why.",
    persona: { tone: "minimal", language: "en", instructions: "Observation → explanation → recommended action. Compare to the campaign's own targets first, benchmarks second.", signOff: undefined },
    allowedTools: ["analyze_performance"],
    availableTools: ["analyze_performance", "search_web"],
    autonomy: "auto_draft",
    enabled: true,
    updatedAt: now(),
  },
  {
    id: "agent_optimizer",
    role: "optimizer",
    name: "Salma",
    emoji: "⚡",
    description: "Proposes budget, placement and creative changes. Never applies anything without your approval.",
    persona: { tone: "professional", language: "en", instructions: "Quantify expected impact and confidence for every recommendation. Prefer reversible changes.", signOff: undefined },
    allowedTools: ["analyze_performance", "generate_ad_variations"],
    availableTools: ["analyze_performance", "generate_ad_variations", "publish_meta_ads"],
    autonomy: "ask_first",
    enabled: true,
    updatedAt: now(),
  },
];

const PILLARS = ["Origin story", "Product in use", "Social proof", "Offer", "Behind the scenes", "Education"];
const TITLES: Record<ContentFormat, string[]> = {
  reel: ["Cold brew pour at golden hour", "Roaster walkthrough in 15s", "3 ways to drink cold brew", "Customer reaction – first sip"],
  post: ["Roasted this week, not this year", "Meet the farm behind the beans", "Bundle of the week", "Barista tip: water ratio"],
  story: ["Poll: iced or hot?", "Flash offer – 24h", "Behind the counter today", "Quiz: guess the origin"],
  ad: ["Cold brew that survives Cairo summer", "Office cold-brew subscription", "Free delivery over 500 EGP"],
  email: ["Your weekly roast drop", "Cold brew bundle – members first"],
  article: ["Why freshness matters more than origin", "Cold brew vs iced coffee"],
};

/** Deterministic pseudo-random so a month renders the same on refetch. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

export function buildMonth(month: string, opts: { postsPerWeek: number; channels: ContentChannel[]; campaignId: string | null }): ContentItem[] {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const rand = rng(y * 100 + m);
  const items: ContentItem[] = [];
  const fmtFor: Record<ContentChannel, ContentFormat[]> = {
    instagram: ["reel", "post", "story"],
    facebook: ["post", "ad"],
    tiktok: ["reel"],
    email: ["email"],
    blog: ["article"],
  };
  const step = 7 / opts.postsPerWeek;
  let cursor = 1 + rand() * step;
  let i = 0;
  while (cursor <= days) {
    const day = Math.floor(cursor);
    const channel = opts.channels[i % opts.channels.length];
    const formats = fmtFor[channel];
    const format = formats[Math.floor(rand() * formats.length)];
    const titles = TITLES[format];
    const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isPast = new Date(date) < new Date(new Date().toDateString());
    items.push({
      id: `ci_${month}_${i}`,
      date,
      time: ["09:00", "12:30", "18:00", "20:30"][Math.floor(rand() * 4)],
      channel,
      format,
      title: titles[Math.floor(rand() * titles.length)],
      hook: format === "reel" ? "Open on the pour. Text: 'still cold at 3pm'." : undefined,
      caption: "Slow-steeped 18 hours. Roasted on the Nile, brewed for you. ☕",
      hashtags: ["#coldbrew", "#cairocoffee", "#nileroasters"],
      status: isPast ? "published" : rand() > 0.6 ? "scheduled" : rand() > 0.5 ? "draft" : "idea",
      campaignId: opts.campaignId ?? (rand() > 0.5 ? "cmp_1" : null),
      creativeId: format === "ad" ? "cr_2" : null,
      pillar: PILLARS[Math.floor(rand() * PILLARS.length)],
      createdAt: now(),
      updatedAt: now(),
    });
    cursor += step;
    i++;
  }
  return items;
}

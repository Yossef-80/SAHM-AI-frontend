# API Contract — `MarketingApi`

This is the single interface the frontend consumes (`src/lib/api/types.ts`). Two implementations exist:

| Implementation | File | When |
|---|---|---|
| `MockApi` | `src/lib/api/mock-api.ts` | `NEXT_PUBLIC_USE_MOCKS` unset or `"true"` (default) |
| `HttpApi` | `src/lib/api/http-api.ts` | `NEXT_PUBLIC_USE_MOCKS="false"`; base URL = `NEXT_PUBLIC_API_BASE` |

**The backend must return JSON that validates against the Zod schemas in `src/types/index.ts`.** `HttpApi` validates every response and throws `ApiError("SCHEMA_MISMATCH")` on drift, so mismatches surface immediately in the UI error state rather than as silent bugs.

All schemas below are the *authoritative names* in `src/types/index.ts` — read that file for exact field types. This document maps methods → HTTP endpoints → schemas.

---

## Conventions

- **Base URL:** `${NEXT_PUBLIC_API_BASE}` (e.g. `https://api.example.com/v1`)
- **Content-Type:** `application/json` both ways. Cookies sent (`credentials: "include"`).
- **IDs:** opaque non-empty strings (`IdSchema`).
- **Dates:** ISO-8601 with offset (`IsoDateSchema`, e.g. `2026-09-25T10:00:00.000Z`).
- **Query params:** for GET methods, the input object is serialised as query string; `undefined` keys are omitted.
- **Errors:** non-2xx responses should return `ApiErrorSchema`:
  ```json
  { "code": "NOT_FOUND", "message": "Campaign cmp_9 not found", "details": {} }
  ```
  The frontend surfaces `message` in the `<AsyncBoundary>` error state / toast and offers Retry.
- **Streaming:** `POST /conversations/messages/stream` is Server-Sent Events. Each event is `data: <SendMessageOutput JSON>` — a **full snapshot** of the exchange so far (not a delta). Text blocks in progress have `streaming: true`. The final event has `streaming` unset/false on all blocks.

---

## Business & Brand

| Method | HTTP | Input | Output |
|---|---|---|---|
| `getBusiness()` | `GET /business` | — | `Business` |
| `getBrandProfile()` | `GET /brand-profile` | — | `BrandProfile` |

---

## Campaigns

| Method | HTTP | Input | Output |
|---|---|---|---|
| `listCampaigns(input?)` | `GET /campaigns?status=&search=` | `ListCampaignsInput` `{ status?: CampaignStatus; search?: string }` | `Campaign[]` |
| `getCampaign(id)` | `GET /campaigns/:id` | — | `Campaign` |
| `createCampaign(draft)` | `POST /campaigns` | `CampaignDraft` | `Campaign` |
| `updateCampaign({ id, patch })` | `PATCH /campaigns/:id` | body = `UpdateCampaignInput.patch` `{ name?, status?, dailyBudget?, endDate? }` | `Campaign` |
| `generateStrategy(input)` | `POST /campaigns/strategy` | `GenerateStrategyInput` `{ objective, audience (partial, no id), dailyBudget, brief? }` | `CampaignStrategy` |
| `getCampaignPerformance(id)` | `GET /campaigns/:id/performance` | — | `MetricPoint[]` (daily, oldest → newest) |
| `getCampaignRecommendations(id)` | `GET /campaigns/:id/recommendations` | — | `Recommendation[]` |
| `getCampaignLearnings(id)` | `GET /campaigns/:id/learnings` | — | `Learning[]` |
| `getAudience(id)` | `GET /audiences/:id` | — | `Audience` |
| `addToCampaign({ campaignId, creativeId })` | `POST /campaigns/:campaignId/creatives` | body `{ creativeId }` | `Campaign` (updated) |

### `CampaignDraft` (input to `createCampaign`)
```ts
{
  name: string (min 2),
  objective: "awareness" | "traffic" | "engagement" | "leads" | "sales" | "app_installs",
  dailyBudget: number (> 0),
  currency: string (3 letters, default "USD"),
  startDate: IsoDate,
  endDate: IsoDate | null,
  audience: Audience without id (id optional — reuse existing audience if provided),
  strategy: CampaignStrategy | null,
  creativeIds: string[],
  launchNow: boolean   // true → backend publishes to Meta and returns status "active"
}
```

### `Campaign` (output)
```ts
{
  id, businessId, name, objective, status: "draft"|"scheduled"|"active"|"paused"|"completed"|"failed",
  dailyBudget: number, currency: string,
  startDate: IsoDate, endDate: IsoDate | null,
  audienceId: string | null,
  strategy: CampaignStrategy | null,
  creativeIds: string[],
  metaCampaignId: string | null,
  metrics: CampaignMetrics | null,   // null until delivery starts
  healthScore: number (0–100) | null,
  createdAt, updatedAt
}
```
`CampaignMetrics`: `{ impressions, reach, clicks, ctr (%), cpc, cpm, conversions, cpa, roas, spend }` — all numbers, currency values in campaign currency.

`CampaignStrategy`: `{ summary, keyMessages[], channels[]: "facebook"|"instagram"|"messenger"|"audience_network", placements[], biddingStrategy: "lowest_cost"|"cost_cap"|"bid_cap"|"roas_goal", phases[]: { name, durationDays, focus }, kpis[]: { metric, target } }`

`MetricPoint`: `{ date: "YYYY-MM-DD", impressions, clicks, conversions, spend }`

---

## Creatives

| Method | HTTP | Input | Output |
|---|---|---|---|
| `listCreatives(campaignId?)` | `GET /creatives?campaignId=` | — | `Creative[]` |
| `getCreative(id)` | `GET /creatives/:id` | — | `Creative` |
| `generateCreative(input)` | `POST /creatives/generate` | `GenerateCreativeInput` | `Creative[]` (length = `count`) |
| `generateVariations(input)` | `POST /creatives/:creativeId/variations` | `GenerateVariationsInput` `{ creativeId, count (1–6, default 3) }` | `Creative[]` |
| `analyzeReference(input)` | `POST /creatives/analyze-reference` | `AnalyzeReferenceInput` | `ReferenceAnalysis` |

### `GenerateCreativeInput`
```ts
{
  kind: "image" | "video" | "copy",
  brief: string (min 3),
  campaignId: string | null,
  referenceAnalysisId?: string,     // set when "Create inspired version" is used
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9",
  count: number (1–6, default 1)
}
```

### `AnalyzeReferenceInput`
```ts
{ source: string /* data: URL (base64 upload) OR https URL */, fileName?: string, kind: CreativeKind }
```

### `Creative`
```ts
{
  id, campaignId: string | null, kind, title,
  status: "draft"|"generating"|"ready"|"approved"|"rejected",
  assetUrl?: url, thumbnailUrl?: url,           // image/video only
  headline?, primaryText?, cta?,
  durationSec?: number, aspectRatio?,
  tags: string[], score?: number (0–100),
  createdAt, updatedAt
}
```

### `ReferenceAnalysis`
```ts
{ id, sourceUrl?, sourceName, kind, hook, structure[], visualStyle[], tone[], cta?,
  strengths[], weaknesses[], estimatedPerformance: "low"|"medium"|"high", inspiredBrief, createdAt }
```

---

## Insights & Recommendations

| Method | HTTP | Input | Output |
|---|---|---|---|
| `getInsights(input?)` | `GET /insights?campaignId=&severity=` | `ListInsightsInput` | `Insight[]` |
| `getRecommendation(id)` | `GET /recommendations/:id` | — | `Recommendation` |
| `applyRecommendation({ recommendationId })` | `POST /recommendations/:id/apply` | — | `Recommendation` (status `"applied"`) |
| `dismissRecommendation({ recommendationId })` | `POST /recommendations/:id/dismiss` | — | `Recommendation` (status `"dismissed"`) |

### `Insight`
```ts
{
  id, campaignId: string | null, creativeId: string | null,
  severity: "info" | "warning" | "critical",
  title, observation, explanation, recommendedAction,
  action: ActionRef | null,          // button rendered by the frontend Action Registry (see ACTIONS.md)
  metric?: { label, value, unit?, delta? /* fraction, e.g. 0.82 = +82% */ },
  createdAt
}
```

### `Recommendation`
```ts
{
  id, campaignId, title, rationale, expectedImpact,
  confidence: number (0–1),
  changes: ChangeDiff[],             // shown verbatim in the human-in-the-loop confirm dialog
  status: "pending" | "applied" | "dismissed",
  createdAt
}
ChangeDiff = { field: string, label: string, before: string|number|boolean|null, after: string|number|boolean|null }
```
**Important:** `changes` is what the user approves. The backend must apply exactly these and nothing more.

### `Learning`
`{ id, campaignId, category: "audience"|"creative"|"timing"|"budget"|"messaging", statement, evidence, confidence (0–1), createdAt }`

---

## Assistant

| Method | HTTP | Input | Output |
|---|---|---|---|
| `listConversations()` | `GET /conversations` | — | `Conversation[]` (newest first) |
| `getConversation(id)` | `GET /conversations/:id` | — | `{ conversation: Conversation; messages: Message[] }` |
| `sendMessage(input)` | `POST /conversations/messages` | `SendMessageInput` | `SendMessageOutput` |
| `streamMessage(input)` | `POST /conversations/messages/stream` (SSE) | `SendMessageInput` | stream of `SendMessageOutput` snapshots |

### `SendMessageInput`
```ts
{
  conversationId: string | null,    // null → create a new conversation
  text: string,
  context: ContextChip[],           // { kind: "campaign"|"creative"|"insight", id, label }
  answer?: { messageId: string, optionIds: string[] }   // reply to a question_with_options block
}
```

### `SendMessageOutput`
`{ conversation: Conversation, userMessage: Message, assistantMessage: Message }`

### `Message`
```ts
{ id, conversationId, role: "user"|"assistant"|"system", blocks: Block[], context: ContextChip[], createdAt }
```

### Block union (`MessageBlockSchema`, discriminated on `type`)
| `type` | Fields |
|---|---|
| `text` | `text: string`, `streaming?: boolean` (inline markdown: `**bold**`, `*italic*`, `` `code` ``) |
| `findings` | `title`, `items[]: { label, detail, sentiment: "positive"\|"negative"\|"neutral" }` |
| `recommendation` | `recommendation: Recommendation` |
| `metric` | `metrics[]: { label, value, unit?, delta?, format: "number"\|"currency"\|"percent"\|"multiplier" }` |
| `action_card` | `title`, `description?`, `actions[]: ActionRef` (min 1) |
| `task_progress` | `taskId`, `task?: AgentTask` (snapshot; frontend polls `GET /tasks/:id` while running) |
| `question_with_options` | `question`, `options[]: { id, label, description? }` (min 2), `multiSelect`, `answeredOptionIds?` |
| `error` | `message`, `retryable` |

**Forward compatibility:** any block with an unrecognised `type` is rendered as plain text (using its `text` or `title` field if present). New block types can ship backend-first without breaking the UI.

### `ActionRef` (used in `action_card.actions` and `Insight.action`)
```ts
{ type: ActionType, label?: string, payload: Record<string, unknown> }
```
`payload` must satisfy the per-action schema in `docs/ACTIONS.md`. Invalid payloads produce a visible toast error rather than a silent no-op.

`Conversation`: `{ id, title, lastMessagePreview, messageCount, createdAt, updatedAt }`

---

## Agent tasks

| Method | HTTP | Input | Output |
|---|---|---|---|
| `startTask(input)` | `POST /tasks` | `StartTaskInput` `{ type: ActionType, payload }` | `AgentTask` |
| `getTask(id)` | `GET /tasks/:id` | — | `AgentTask` |

### `AgentTask`
```ts
{
  id, type: ActionType, status: "queued"|"running"|"succeeded"|"failed",
  label, progress: number (0–100),
  steps[]: { label, status },
  resultRef: { entity: "campaign"|"creative"|"insight"|"recommendation"|"analysis"|"conversation", id } | null,
  error: string | null, createdAt, updatedAt
}
```
**Expected behaviour for agent-type tasks** (`ANALYZE_CAMPAIGN`, `ANALYZE_CREATIVE`, `RESEARCH_COMPETITORS`, `OPTIMIZE_CAMPAIGN`, `ANALYZE_WEBSITE`, `ANALYZE_SOCIAL_PROFILE`, `ANALYZE_REVIEWS`, `ANALYZE_MARKET`, `ANALYZE_KEYWORDS`, `ANALYZE_COMPETITOR_CREATIVES`, `DETECT_MARKET_GAPS`, `GENERATE_MARKETING_STRATEGY`): the backend creates a conversation, posts a `task_progress` block in it, and returns `resultRef = { entity: "conversation", id }`. The frontend navigates there, polls the task every 1s while `queued|running`, and refetches the conversation on completion — results should be appended to the same assistant message (or a new one) by then.

---


## Content calendar

| Method | HTTP | Input | Output |
|---|---|---|---|
| `listContentItems(input)` | `GET /content?month=YYYY-MM&campaignId=` | `ListContentInput` | `ContentItem[]` (month-scoped) |
| `generateContentCalendar(input)` | `POST /content/generate` | `GenerateContentCalendarInput` | `ContentItem[]` — **replaces** that month's items for the given campaign scope |
| `updateContentItem(input)` | `PATCH /content/:id` | `UpdateContentItemInput` `{ id, patch }` | `ContentItem` |
| `deleteContentItem(id)` | `DELETE /content/:id` | — | `void` |

### `ContentItem`
```ts
{
  id, date: "YYYY-MM-DD", time?: "HH:mm",
  channel: "instagram"|"facebook"|"tiktok"|"email"|"blog",
  format: "post"|"reel"|"story"|"ad"|"email"|"article",
  title, hook?, caption?, hashtags: string[],
  status: "idea"|"draft"|"scheduled"|"published",
  campaignId: Id|null, creativeId: Id|null, pillar?, createdAt, updatedAt
}
```
### `GenerateContentCalendarInput`
`{ month: "YYYY-MM", campaignId: Id|null = null, postsPerWeek: 1–14 = 4, channels: ContentChannel[] = ["instagram","facebook"], brief? }`

## Text generation

| Method | HTTP | Input | Output |
|---|---|---|---|
| `generateText(input)` | `POST /generate/text` | `GenerateTextInput` | `GeneratedText` |

`GenerateTextInput`: `{ tool: "generate_creative_brief"|"generate_commercial_script"|"generate_image_prompt"|"generate_video_prompt"|"generate_ad_copy", brief (min 3), campaignId?, creativeId?, language: "en"|"ar" = "en" }`
`GeneratedText`: `{ id, tool, title, sections: { heading, body }[], plainText, createdAt }` — `plainText` is what "Copy" and "Use as creative brief" consume.

## Agents & personas

| Method | HTTP | Input | Output |
|---|---|---|---|
| `listAgents()` | `GET /agents` | — | `Agent[]` |
| `updateAgent(input)` | `PATCH /agents/:id` | `UpdateAgentInput` `{ id, patch }` | `Agent` |

### `Agent`
```ts
{
  id, role: "researcher"|"strategist"|"creative"|"analyst"|"optimizer",
  name, emoji, description,
  persona: { tone: "professional"|"friendly"|"bold"|"playful"|"minimal", language: "en"|"ar", instructions: string (≤2000), signOff? },
  allowedTools: AgentTool[],      // ⊆ availableTools; the UI only offers toggles for availableTools
  availableTools: AgentTool[],    // decided by the backend per role
  autonomy: "ask_first"|"suggest"|"auto_draft",
  enabled: boolean, updatedAt
}
```
`AgentTool` = the tool ids from the product spec (`search_web`, `analyze_website`, … `generate_ad_variations`, `publish_meta_ads`, `analyze_performance`).
**Autonomy never bypasses human-in-the-loop:** live-campaign mutations (`APPLY_RECOMMENDATION`, `ADD_TO_CAMPAIGN`, `UPDATE_CAMPAIGN`, launch) always show the diff + confirm dialog regardless of `autonomy`.

---

## Integrations (Meta)

| Method | HTTP | Output |
|---|---|---|
| `getMetaConnection()` | `GET /integrations/meta` | `MetaConnection` |
| `connectMeta()` | `POST /integrations/meta/connect` | `MetaConnection` |
| `reauthMeta()` | `POST /integrations/meta/reauth` | `MetaConnection` |
| `disconnectMeta()` | `POST /integrations/meta/disconnect` | `MetaConnection` |

### `MetaConnection`
```ts
{
  status: "not_connected" | "connecting" | "connected" | "needs_reauth" | "error",
  accountId, accountName, pageName: string | null,
  permissions: string[],
  connectedAt, expiresAt: IsoDate | null,
  errorMessage: string | null
}
```
The frontend polls `GET /integrations/meta` every 1s while `status === "connecting"`. With real OAuth, `connect` may return `connecting` immediately (after opening the OAuth popup/redirect) and the poll picks up the terminal state.

---

## Settings

| Method | HTTP | Input | Output |
|---|---|---|---|
| `getSettings()` | `GET /settings` | — | `Settings` |
| `updateSettings(patch)` | `PATCH /settings` | `Partial<Settings>` | `Settings` |

`Settings`: `{ locale: "en"|"ar", timezone, currency, notifications: { email, criticalInsights, weeklyDigest } }`

---

## Frontend-side data flow (for reference)

```
Component → hook (src/hooks/use-api.ts, TanStack Query) → api (src/lib/api/index.ts) → MockApi | HttpApi
Button    → <ActionButton> → useAction() → dispatchAction() → registry handler → api.*
```
No component imports `fetch`, `MockApi`, or fixture data directly. Query keys live in `src/lib/query-keys.ts`; action handlers invalidate the relevant keys after mutations.

# Action Registry

**File:** `src/lib/actions/registry.ts` · **Dispatcher:** `src/lib/actions/dispatch.ts` · **Hook:** `src/hooks/use-action.ts` · **Button:** `src/components/shared/action-button.tsx`

Every domain action in the app — chat action cards, Insights buttons, Home "Needs attention", campaign Recommendations, creative card menus, Integrations, the campaign wizard's Save/Launch, Pause/Resume/Edit budget — dispatches through this registry. There are no one-off `onClick` handlers that call the API.

## Pipeline

```
dispatchAction(ref, ctx)
  1. validate     ref.payload against def.payloadSchema (Zod)  → throws INVALID_ACTION_PAYLOAD
  2. prepare      optional: collect missing input (e.g. campaign picker) → null = cancelled
  3. confirm      if def.requiresConfirmation(payload): getDiff() → <ConfirmDialog before/after> → user must click "Confirm & apply"
  4. handler      calls MarketingApi, invalidates TanStack Query keys, returns ActionResult
useAction()
  5. toast        result.toastKey (i18n) as success/error; ActionCancelledError → info toast
  6. navigate     result.navigateTo via next/navigation
```

Human-in-the-loop is enforced **centrally in step 3**, not per button. An action that changes a live campaign can't skip it.

## `ActionRef` (wire format)

```ts
{ type: ActionType, label?: string, payload: Record<string, unknown> }
```
`label` overrides the button text (backend-provided copy); otherwise the i18n key `actions.<TYPE>` is used.

## `ActionContext` (available to handlers)

| Field | Purpose |
|---|---|
| `api` | `MarketingApi` (mock or HTTP) |
| `queryClient` | invalidate / read cached data |
| `navigate(href)` | router push |
| `t(key, values)` | translations in the `actions` namespace |
| `confirm({ title, description?, diff, confirmLabel? })` | before/after dialog → `Promise<boolean>` |
| `pickCampaign(title)` | campaign picker dialog → `Promise<string \| null>` |
| `ui.setCreateCreative(...)`, `ui.setCampaignPrefill(...)` | hand off to UI dialogs / wizard |

## `ActionResult`

```ts
{ ok: boolean; toastKey?: string; toastValues?: Record<string, string|number>; navigateTo?: string; data?: unknown }
```

---

## Actions

| Type | Payload schema | Confirm? | Handler behaviour | Navigates to |
|---|---|---|---|---|
| `CREATE_CAMPAIGN` | `{ draft?: CampaignDraft, prefill?: Partial<CampaignDraft>, angle?: string }` | **Only if `draft.launchNow`** (diff: status draft→active, budget 0→X) | With `draft`: `api.createCampaign` → invalidate `campaigns`. Without: store `prefill` and open the wizard. | `/campaigns/:id` or `/campaigns/new` |
| `CREATE_CREATIVE` | `{ kind: "image"\|"video"\|"copy" (default image), brief?, campaignId?, referenceAnalysisId?, aspectRatio?, count? }` | No | With `brief`: `api.generateCreative` → invalidate `creatives`. Without: open the Create dialog pre-set to `kind` (the dialog re-dispatches with a brief). | `/creatives` |
| `GENERATE_VARIATIONS` | `{ creativeId, count (1–6, default 3) }` | No | `api.generateVariations` → invalidate `creatives` | `/creatives` |
| `ANALYZE_CAMPAIGN` | `{ campaignId }` | No | `api.startTask({type, payload})` → invalidate `conversations` | `/assistant/:conversationId` from `task.resultRef` |
| `ANALYZE_CREATIVE` | `{ creativeId }` | No | same as above | same |
| `RESEARCH_COMPETITORS` | `{ query? }` | No | same as above | same |
| `OPTIMIZE_CAMPAIGN` | `{ campaignId }` | No | same as above | same |
| `CONNECT_META` | `{ mode: "connect"\|"reauth"\|"disconnect" (default connect) }` | No | Optimistically sets `connecting` in cache, calls `connectMeta` / `reauthMeta` / `disconnectMeta`, writes result to cache. `ok=false` if resulting status is `error`. | — |
| `APPLY_RECOMMENDATION` | `{ recommendationId }` | **Yes** — diff = `recommendation.changes` (fetched via `api.getRecommendation`) | `api.applyRecommendation` → invalidate `campaign`, `campaigns`, `insights`, `conversation` | — |
| `ADD_TO_CAMPAIGN` | `{ creativeId, campaignId? }` | **Yes** — diff: creative count n→n+1, campaign status | `prepare`: if no `campaignId`, open campaign picker. `api.addToCampaign` → invalidate `campaign`, `campaigns`, `creatives` | — |
| `ANALYZE_WEBSITE` | `{ url }` | No | `api.startTask` (agent task) | `/assistant/:conversationId` |
| `ANALYZE_SOCIAL_PROFILE` | `{ handle, platform? }` (also covers *analyze_social_content*) | No | agent task | same |
| `ANALYZE_REVIEWS` | `{ source? }` | No | agent task | same |
| `ANALYZE_MARKET` | `{ query? }` | No | agent task | same |
| `ANALYZE_KEYWORDS` | `{ seed }` | No | agent task | same |
| `ANALYZE_COMPETITOR_CREATIVES` | `{ competitor? }` | No | agent task | same |
| `DETECT_MARKET_GAPS` | `{}` | No | agent task | same |
| `GENERATE_MARKETING_STRATEGY` | `{ brief? }` | No | agent task | same |
| `GENERATE_CONTENT_CALENDAR` | `GenerateContentCalendarInput` (`month` optional → current month) | No | `api.generateContentCalendar` → invalidate `content` | `/calendar?month=YYYY-MM` |
| `GENERATE_TEXT` | `GenerateTextInput` `{ tool, brief, campaignId?, creativeId?, language? }` | No | `api.generateText` → result placed in `ui.generatedText` (rendered by the Write-with-AI dialog; copy / "Use as creative brief" → `CREATE_CREATIVE`) | — |
| `UPDATE_AGENT` | `UpdateAgentInput` `{ id, patch }` | No (persona config is not a live-campaign change) | `api.updateAgent` → invalidate `agents` | — |
| `UPDATE_CAMPAIGN` *(added, see note)* | `{ campaignId, patch: { status?, dailyBudget?, name? } }` | **Yes** — diff per changed field, before = current cached campaign | `api.updateCampaign` → invalidate `campaign`, `campaigns` | — |

> **Note on `UPDATE_CAMPAIGN`:** not in the original list of 10. Added so Pause/Resume and Edit-budget on the campaign page route through the same registry and confirm-diff pipeline instead of one-off handlers. Remove it if the backend prefers to express those as recommendations.

> **Research tool mapping:** `analyze_competitor` = existing `RESEARCH_COMPETITORS`; `analyze_social_content` is folded into `ANALYZE_SOCIAL_PROFILE` (same handle, agent inspects both profile and recent content); `search_web` is backend-internal and only appears as a step/finding inside task results. `generate_campaign_strategy` is part of `OPTIMIZE_CAMPAIGN` / the campaign wizard; `generate_ad_variations` = `GENERATE_VARIATIONS`.

## Where each action is used

| Surface | Actions |
|---|---|
| Home → capability tiles | `RESEARCH_COMPETITORS`, `CREATE_CAMPAIGN`, `ANALYZE_CAMPAIGN`, `OPTIMIZE_CAMPAIGN` |
| Home → Needs attention | whatever `Insight.action` the API returns |
| Assistant → `action_card` blocks | any (backend-driven) |
| Assistant → `recommendation` blocks | `APPLY_RECOMMENDATION` |
| Campaigns list / empty states | `CREATE_CAMPAIGN` |
| Campaign wizard → Launch step | `CREATE_CAMPAIGN` with `draft` (`launchNow` true/false) |
| Campaign detail header | `ANALYZE_CAMPAIGN`, `OPTIMIZE_CAMPAIGN`, `UPDATE_CAMPAIGN` (pause/resume/budget) |
| Campaign → Recommendations tab | `APPLY_RECOMMENDATION` (+ non-mutating dismiss via hook) |
| Campaign → Strategy/Creatives empty states | `OPTIMIZE_CAMPAIGN`, `CREATE_CREATIVE` |
| Creatives page | `CREATE_CREATIVE` (menu + dialog), card menu: `GENERATE_VARIATIONS`, `ANALYZE_CREATIVE`, `ADD_TO_CAMPAIGN` |
| Analyze Reference → "Create inspired version" | `CREATE_CREATIVE` with `brief = inspiredBrief`, `referenceAnalysisId` |
| Insights | `Insight.action` from API |
| Integrations → Meta card | `CONNECT_META` with mode derived from the state machine |
| Research hub (`/research`) tool cards | `ANALYZE_WEBSITE`, `RESEARCH_COMPETITORS`, `ANALYZE_SOCIAL_PROFILE`, `ANALYZE_REVIEWS`, `ANALYZE_MARKET`, `ANALYZE_KEYWORDS`, `ANALYZE_COMPETITOR_CREATIVES`, `DETECT_MARKET_GAPS`, `GENERATE_MARKETING_STRATEGY` |
| Assistant chat (natural language) | the mock router triggers the same research/strategy/calendar task types from phrases like "analyze website …", "keywords for …", "plan a content calendar" |
| Calendar (`/calendar`) → Generate / Regenerate dialog | `GENERATE_CONTENT_CALENDAR`; item sheet → `CREATE_CREATIVE` (edit/delete of items use `useUpdateContentItem` / `useDeleteContentItem` mutations) |
| Creatives → "Write with AI" menu | `GENERATE_TEXT` (5 text tools) → `CREATE_CREATIVE` with generated text as brief |
| Agents (`/agents`) → enable switch + persona editor | `UPDATE_AGENT` |

## Adding a new action

1. Add the literal to `ActionTypeSchema` in `src/types/index.ts`.
2. Add a `define({...})` entry in `actionRegistry` (TypeScript fails to compile until every `ActionType` has one).
3. Add `TASK_STEPS[<TYPE>]` in `mock-api.ts` if it can be a task.
4. Add `actions.<TYPE>` labels to `messages/en.json` and `messages/ar.json`.
5. Set `requiresConfirmation: true` (or a payload predicate) + `getDiff` if it mutates a live campaign.

## Usage

```tsx
// Declarative
<ActionButton action={{ type: "APPLY_RECOMMENDATION", payload: { recommendationId } }} size="sm" />

// Imperative (e.g. inside a dropdown menu item)
const { dispatch, isPending } = useAction();
await dispatch({ type: "GENERATE_VARIATIONS", payload: { creativeId, count: 3 } });
```

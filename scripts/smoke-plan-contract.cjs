/**
 * Contract smoke test for the plan & observability page.
 *
 * The page is the only consumer of four endpoints that were added on the backend
 * after this frontend was written, so the failure modes worth catching are all
 * *contract* failures rather than visual ones:
 *
 *   1. a translation key that exists in one locale and not the other
 *      (`next-intl` renders the raw key or throws, depending on config);
 *   2. a method missing from `MockApi` — the default runtime is mocked, so the
 *      page would work with a real API and break in the demo;
 *   3. a plan id that drifts from the backend enum;
 *   4. the route file disappearing while the nav still links to it.
 *
 * Run with: npm run test:plan-contract
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

/* --------------------------------------------------- 1. translation coverage */

const view = read("src/components/assistant/../settings/plan-view.tsx");
assert.match(view, /useTranslations\("plan"\)/, "plan-view must read the `plan` namespace");

const usedKeys = [...view.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]);
assert.ok(usedKeys.length > 20, `expected the page to use many keys, found ${usedKeys.length}`);

for (const locale of ["en", "ar"]) {
  const messages = JSON.parse(read(`messages/${locale}.json`));
  const plan = messages.plan;
  assert.ok(plan, `${locale}.json is missing the "plan" namespace`);
  const missing = usedKeys.filter((key) => typeof plan[key] !== "string");
  assert.deepEqual(missing, [], `${locale}.json is missing plan keys: ${missing.join(", ")}`);
  assert.ok(messages.nav.plan, `${locale}.json is missing nav.plan`);
  assert.ok(messages.settings.adminPlan, `${locale}.json is missing settings.adminPlan`);
}

/* Same key set in both languages: Arabic is a translation, not a subset. */
const enKeys = Object.keys(JSON.parse(read("messages/en.json")).plan).sort();
const arKeys = Object.keys(JSON.parse(read("messages/ar.json")).plan).sort();
assert.deepEqual(arKeys, enKeys, "en/ar plan namespaces must have identical keys");

/* --------------------------------------------------------- 2. API surface */

const iface = read("src/lib/api/types.ts");
for (const method of [
  "getSubscriptionPlans",
  "getSubscription",
  "switchPlan",
  "getObservabilityStatus",
]) {
  assert.match(iface, new RegExp(`${method}\\(`), `MarketingApi is missing ${method}`);
}

const httpApi = read("src/lib/api/http-api.ts");
for (const route of [
  "/subscriptions/plans",
  "/subscriptions/current",
  "/subscriptions/observability",
  "/subscriptions/switch",
]) {
  assert.ok(httpApi.includes(route), `HttpApi never calls ${route}`);
}

const mockApi = read("src/lib/api/mock-api.ts");
for (const method of [
  "getSubscriptionPlans",
  "getSubscription",
  "switchPlan",
  "getObservabilityStatus",
]) {
  assert.match(mockApi, new RegExp(`async ${method}\\(`), `MockApi is missing ${method}`);
}

/* The switch body is snake_case on the wire; a camelCase body is silently ignored. */
assert.ok(
  httpApi.includes('plan_id: planId'),
  "switchPlan must send `plan_id`, not `planId`",
);

/* ------------------------------------------------------------- 3. contract */

const types = read("src/types/index.ts");
assert.match(types, /PlanIdSchema = z\.enum\(\["free", "pro", "enterprise"\]\)/, "plan ids drifted");
assert.match(types, /dailyTokenBudget:/, "SubscriptionPlan lost dailyTokenBudget");
assert.match(types, /percentConsumed:/, "WorkspaceSubscription lost percentConsumed");

const usageView = read("src/components/settings/usage-view.tsx");
assert.ok(usageView.includes("percentUsed"), "usage view untouched");

/* ---------------------------------------------------------------- 4. routes */

for (const route of ["src/app/settings/plan/page.tsx", "src/app/research/page.tsx"]) {
  assert.ok(fs.existsSync(path.join(root, route)), `missing route ${route}`);
}

const nav = read("src/components/layout/nav-config.ts");
assert.ok(nav.includes('href: "/settings/plan"'), "nav does not link to the plan page");

/* ------------------------------------------------------------------ report */

console.log(
  `Plan & observability contract: ok (${usedKeys.length} keys x 2 locales, 4 endpoints, 2 routes)`,
);

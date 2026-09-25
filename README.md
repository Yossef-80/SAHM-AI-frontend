# AI Marketing Operating System — Frontend

Next.js 14 (App Router) · TypeScript strict · Tailwind · shadcn/ui · Zustand · TanStack Query · Zod · next-intl (en/ar, RTL)

## Run
```bash
npm install
npm run dev        # http://localhost:3000 — runs on MockApi by default
```

## Environment
| Var | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCKS` | `true` | `false` → use `HttpApi` against the real backend |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000/api` | base URL for `HttpApi` |
| `NEXT_PUBLIC_MOCK_ERROR_RATE` | `0.1` | simulated failure rate for mocks (set `0` for demos) |

## Structure
```
src/types            Zod schemas + domain types (the contract)
src/lib/api          MarketingApi interface, MockApi, HttpApi, switch
src/lib/actions      Action Registry + dispatcher (human-in-the-loop enforced here)
src/lib/mock         Mock fixtures (fixtures.ts business/campaigns; fixtures-extra.ts agents + deterministic calendar generator)
src/hooks            TanStack Query hooks (only place that calls `api`), useAction, useChat
src/store            Zustand: assistant context/stream, UI dialogs
src/components       ui (shadcn) · shared (AsyncBoundary, ActionButton, dialogs) · per-feature
src/app              Routes: / assistant[/id] research campaigns[/new,/id] calendar creatives insights agents integrations settings
src/i18n + messages  next-intl config, en.json, ar.json
docs/                API_CONTRACT.md · ACTIONS.md
```

## Checks
```bash
./node_modules/.bin/tsc --noEmit && npm run lint
```

## Agent tool coverage
Research tools (website, competitor, social profile/content, reviews, market, keywords, competitor creatives, market gaps) run from **/research** or from chat and stream into a conversation. Generation tools: marketing strategy (agent task), content calendar (**/calendar**, real month grid, editable items), ad copy / creative brief / commercial script / image prompt / video prompt (Creatives → *Write with AI*), ad variations (creative card menu). Agent personas (name, emoji, tone, language, instructions, allowed tools, autonomy, enabled) are edited on **/agents**. See `docs/ACTIONS.md` for the mapping.

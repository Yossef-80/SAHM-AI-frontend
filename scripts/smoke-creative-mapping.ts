/**
 * Creative mapping smoke test — the wire shape the UI actually renders.
 *
 * Why this exists
 * ---------------
 * `mapCreative` silently disagreed with the backend twice, and neither time was
 * caught by `tsc` (every value was still a valid string) or by a component test
 * (the components were fine — they were handed the wrong object):
 *
 *   1. `kind` was hardcoded to "image", so saved ad copy rendered as an empty
 *      image card, the copy filter was permanently empty, and the "edit copy"
 *      entry point (which feeds Layla's learning loop) never appeared.
 *   2. `status` only accepted "ready", but the backend writes "ok" for a
 *      finished image — so every generated creative showed as a draft.
 *
 * Run: npm run test:creative-mapping (exit 1 on any mismatch)
 */

import { mapCreative } from "../src/lib/api/adapters";
import { CreativeSchema } from "../src/types";

type Case = {
  name: string;
  raw: Record<string, unknown>;
  expect: Partial<{
    kind: string;
    status: string;
    title: string;
    headline: string | undefined;
    primaryText: string | undefined;
    hasAsset: boolean;
  }>;
};

const cases: Case[] = [
  {
    name: "generated image (Supabase URL, backend status 'ok')",
    raw: {
      id: "asset_1",
      url: "https://abcd.supabase.co/storage/v1/object/public/creatives/generated/openai/asset_1.png",
      prompt: "قهوة مختصة في المكتب",
      kind: "image",
      status: "ok",
      aspectRatio: "1:1",
    },
    expect: { kind: "image", status: "ready", hasAsset: true, headline: undefined },
  },
  {
    name: "saved ad copy (kind=copy, url empty, two-line prompt)",
    raw: {
      id: "draft_1",
      url: "",
      prompt: "قهوة أحلى، شغل أحلى\n\nخصم 12% للفرق، وتوصيل خلال أيام العمل داخل القاهرة.",
      kind: "copy",
      status: "ready",
      aspect_ratio: "1:1",
    },
    expect: {
      kind: "copy",
      status: "ready",
      hasAsset: false,
      title: "قهوة أحلى، شغل أحلى",
      headline: "قهوة أحلى، شغل أحلى",
      primaryText: "خصم 12% للفرق، وتوصيل خلال أيام العمل داخل القاهرة.",
    },
  },
  {
    name: "single-line copy",
    raw: { id: "draft_2", url: "", prompt: "وصل بن طازة لمكتبك", kind: "copy", status: "ok" },
    expect: {
      kind: "copy",
      status: "ready",
      hasAsset: false,
      headline: "وصل بن طازة لمكتبك",
      primaryText: undefined,
    },
  },
  {
    name: "uploaded image stored inline as a data URL",
    raw: {
      id: "cr_1",
      url: "data:image/png;base64,iVBORw0KGgo=",
      prompt: "ملاحظة",
      kind: "image",
      status: "ok",
      aspect_ratio: "9:16",
    },
    expect: { kind: "image", status: "ready", hasAsset: true },
  },
  {
    name: "a creative whose bytes never reached storage (unpersisted)",
    raw: { id: "cr_2", url: "", prompt: "p", kind: "image", status: "unpersisted" },
    expect: { kind: "image", status: "draft", hasAsset: false },
  },
];

let failures = 0;

for (const testCase of cases) {
  const mapped = mapCreative(testCase.raw);
  const parsed = CreativeSchema.safeParse(mapped);
  const problems: string[] = [];

  if (!parsed.success) problems.push(`CreativeSchema rejected it: ${JSON.stringify(parsed.error.issues[0])}`);
  for (const [key, wanted] of Object.entries(testCase.expect)) {
    if (key === "hasAsset") {
      const has = Boolean(mapped.assetUrl && mapped.thumbnailUrl);
      if (has !== wanted) problems.push(`asset urls: expected ${String(wanted)}, got ${String(has)}`);
      continue;
    }
    const actual = (mapped as Record<string, unknown>)[key];
    if (actual !== wanted) problems.push(`${key}: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`);
  }

  if (problems.length > 0) {
    failures += 1;
    console.error(`FAIL  ${testCase.name}`);
    for (const problem of problems) console.error(`        ${problem}`);
  } else {
    console.log(`ok    ${testCase.name}  [kind=${mapped.kind} status=${mapped.status}]`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} of ${cases.length} mapping cases failed.`);
  process.exit(1);
}
console.log(`\nCreative mapping smoke test passed: ${cases.length} cases.`);

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const sourcePath = path.resolve(__dirname, "../src/lib/campaigns/meta-campaigns.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(compiled, sourcePath);
const {
  filterImportedMetaCampaigns,
  filterSahmCampaigns,
  metaCampaignObjectiveKey,
  normalizeMetaCampaignStatus,
} = loaded.exports;

const sahmCampaign = {
  id: "cmp_local",
  name: "Campaign in Sahm",
  status: "active",
  metaCampaignId: "10001",
  createdAt: "2026-09-10T00:00:00.000Z",
};
const importedRows = [
  { metaCampaignId: "10001", name: "Already in Sahm", status: "ACTIVE", effectiveStatus: "ACTIVE" },
  { metaCampaignId: "20001", name: "Imported active", status: "ACTIVE", effectiveStatus: "ACTIVE" },
  { metaCampaignId: "20002", name: "Imported paused", status: "ACTIVE", effectiveStatus: "CAMPAIGN_PAUSED" },
];

assert.deepEqual(
  filterImportedMetaCampaigns(importedRows, [sahmCampaign], "", "all").map((row) => row.metaCampaignId),
  ["20001", "20002"],
  "A linked Meta campaign should appear only once as a Sahm row.",
);
assert.deepEqual(
  filterImportedMetaCampaigns(importedRows, [sahmCampaign], "20002", "paused").map((row) => row.metaCampaignId),
  ["20002"],
  "Imported campaign search/status filters should use Meta IDs and effective state.",
);
assert.deepEqual(
  filterSahmCampaigns([sahmCampaign], "campaign", "active").map((row) => row.id),
  ["cmp_local"],
);
assert.equal(normalizeMetaCampaignStatus(importedRows[2]), "paused");
assert.equal(metaCampaignObjectiveKey("OUTCOME_SALES"), "sales");
assert.equal(metaCampaignObjectiveKey("UNMAPPED_META_OBJECTIVE"), null);

console.log("Meta campaign list smoke test passed: deduplication, filters, and status/objective mapping.");

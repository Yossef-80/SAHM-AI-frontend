const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(relativePath) {
  const sourcePath = path.resolve(__dirname, relativePath);
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
  return loaded.exports;
}

const { getMockMetaTargetingResults } = loadTypeScript("../src/lib/api/mock-targeting.ts");
const { buildMetaDetailedTargeting } = loadTypeScript("../src/lib/api/meta-targeting.ts");
const cases = [
  ["interests", "cars"],
  ["behaviors", "travel"],
  ["job_titles", "business"],
  ["employers", "example"],
  ["education_majors", "market"],
  ["education_schools", "cairo"],
  ["life_events", "moved"],
  ["industries", "food"],
  ["income", "household"],
  ["family_statuses", "parent"],
  ["devices", "iphone"],
  ["operating_systems", "ios"],
];

for (const [category, query] of cases) {
  const results = getMockMetaTargetingResults(query, category);
  assert.ok(results.length > 0, `Expected a mock result for ${category}`);
  for (const result of results) {
    assert.equal(result.category, category, `Wrong category on ${category} result`);
    assert.ok(result.id.startsWith("mock-"), `Expected a visibly synthetic ID for ${category}`);
    assert.ok(result.name, `Expected a Meta-like result name for ${category}`);
  }
}
assert.deepEqual(getMockMetaTargetingResults("no matching phrase", "interests"), []);

const selectedTargets = [
  { id: "id-interest-1", name: "Coffee", category: "interests" },
  { id: "id-interest-2", name: "Tea", category: "interests" },
  { id: "id-behavior", name: "Frequent travelers", category: "behaviors" },
  { id: "id-job", name: "Business owner", category: "job_titles" },
  { id: "id-employer", name: "Example company", category: "employers" },
  { id: "id-major", name: "Marketing", category: "education_majors" },
  { id: "id-school", name: "Cairo University", category: "education_schools" },
  { id: "id-life-event", name: "Recently moved", category: "life_events" },
  { id: "id-industry", name: "Food and beverage", category: "industries" },
  { id: "id-income", name: "Household income segment", category: "income" },
  { id: "id-family", name: "Parent", category: "family_statuses" },
  { id: "mock-devices-iphone", name: "iPhone", category: "devices" },
  { id: "mock-operating-systems-ios", name: "iOS", category: "operating_systems" },
];
const targeting = buildMetaDetailedTargeting(selectedTargets);
assert.deepEqual(targeting, {
  flexible_spec: [
    {
      interests: [
        { id: "id-interest-1", name: "Coffee" },
        { id: "id-interest-2", name: "Tea" },
      ],
      behaviors: [{ id: "id-behavior", name: "Frequent travelers" }],
      work_positions: [{ id: "id-job", name: "Business owner" }],
      work_employers: [{ id: "id-employer", name: "Example company" }],
      education_majors: [{ id: "id-major", name: "Marketing" }],
      education_schools: [{ id: "id-school", name: "Cairo University" }],
      life_events: [{ id: "id-life-event", name: "Recently moved" }],
      industries: [{ id: "id-industry", name: "Food and beverage" }],
      income: [{ id: "id-income", name: "Household income segment" }],
      family_statuses: [{ id: "id-family", name: "Parent" }],
    },
  ],
  user_device: ["iPhone"],
  user_os: ["iOS"],
});
assert.deepEqual(buildMetaDetailedTargeting([]), {});

console.log(`Mock Meta targeting and field mapping passed for ${cases.length} categories.`);

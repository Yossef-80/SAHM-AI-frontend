/* Offline smoke test for legacy Layla cards -> Write with AI -> saved-task Zod mapping. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const srcRoot = path.resolve(__dirname, "..", "src");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) request = path.join(srcRoot, request.slice(2));
  return resolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(compiled, filename);
};

const { mapAgentTask, mapBlock } = require("../src/lib/api/adapters.ts");
const { actionRegistry } = require("../src/lib/actions/registry.ts");
const { AgentTaskSchema, MessageBlockSchema } = require("../src/types/index.ts");

async function main() {
  const block = mapBlock({
    type: "action_card",
    label: "Generate new creative variations",
    description: "Refresh the fatigued creative",
    target_persona: "layla",
    task: "ad_variations",
    inputs: {
      brief: "Three fresh coffee hooks",
      campaign_id: null,
    },
  });
  assert.equal(block.type, "action_card");
  assert.equal(block.actions[0].type, "GENERATE_VARIATIONS");
  MessageBlockSchema.parse(block);

  let textRequest;
  const context = {
    ui: {
      setTextRequest: (input) => { textRequest = input; },
    },
  };
  const payload = actionRegistry.GENERATE_VARIATIONS.payloadSchema.parse({
    ...block.actions[0].payload,
    conversationId: "conv_action",
  });
  const actionResult = await actionRegistry.GENERATE_VARIATIONS.handler(payload, context);
  assert.equal(actionResult.ok, true);
  assert.equal(actionResult.navigateTo, "/creatives");
  assert.deepEqual(textRequest, {
    tool: "generate_ad_variations",
    brief: "Three fresh coffee hooks\n\nPlease provide 3 distinct ad variations.",
    campaignId: null,
  });

  const fixtureCandidates = [
    path.resolve(__dirname, "../../SAHM-AI-backend/tests/fixtures/task_response.json"),
    path.resolve(__dirname, "../../backend/tests/fixtures/task_response.json"),
  ];
  const fixturePath = fixtureCandidates.find((p) => fs.existsSync(p)) || fixtureCandidates[0];
  const wireTask = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const task = mapAgentTask(wireTask);
  AgentTaskSchema.parse(task);
  assert.equal(task.type, "GENERATE_VARIATIONS");
  assert.deepEqual(task.resultRef, { entity: "conversation", id: "conv_contract" });
  assert.equal(task.result.output.variations.length, 2);

  console.log("legacy Layla action-card -> Write with AI, plus saved-task Zod mapping: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

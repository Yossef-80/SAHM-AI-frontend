/* Offline smoke test for the exact backend assistant fixture -> frontend Zod contract. */
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

const { mapMessage } = require("../src/lib/api/adapters.ts");
const {
  ConversationSchema,
  MessageSchema,
  SendMessageOutputSchema,
} = require("../src/types/index.ts");

const wire = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../backend/tests/fixtures/assistant_message_response.json"), "utf8"),
);
const conversationId = wire.conversationId;
const userMessage = mapMessage(wire.userMessage, conversationId);
const assistantMessage = mapMessage(wire.message, conversationId);
const conversation = ConversationSchema.parse({
  id: conversationId,
  title: "Research the supplied static website.",
  lastMessagePreview: "Research the supplied static website.",
  messageCount: 2,
  createdAt: wire.userMessage.createdAt,
  updatedAt: wire.message.createdAt,
});

MessageSchema.parse(userMessage);
MessageSchema.parse(assistantMessage);
const output = SendMessageOutputSchema.parse({ conversation, userMessage, assistantMessage });
assert.equal(output.assistantMessage.blocks[1].type, "findings");
assert.equal(output.assistantMessage.blocks[2].type, "action_card");
assert.equal(output.assistantMessage.blocks[2].actions[0].type, "GENERATE_VARIATIONS");
assert.equal(output.userMessage.role, "user");

console.log("backend AssistantMessageResponse -> adapter -> Message/SendMessageOutput Zod contract: ok");

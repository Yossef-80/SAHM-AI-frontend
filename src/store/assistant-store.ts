import { create } from "zustand";
import type { AssistantProgressEvent, ContextChip, Message, SendMessageInput } from "@/types";

export type PendingPrompt = {
  text: string;
  context: ContextChip[];
  personaId?: string;
  workflow?: "creative_prompt";
  promptType?: "image" | "video";
  creativeMode?: "chat" | "prompt" | "design";
  referenceAnalysisId?: string;
} | null;

/**
 * Explicit "let the orchestrator pick" choice.
 *
 * Distinct from `null` (meaning "no explicit choice yet"): without this, a user
 * who deliberately switched back to automatic routing in an ongoing conversation
 * would be silently pinned to whatever agent the conversation had recorded.
 * Also satisfies Radix Select, which rejects an empty string as an item value.
 */
export const AUTO_PERSONA = "__auto__";

/** In-flight (streaming) exchange, kept outside React so it survives route changes. */
export type ActiveStream = {
  conversationId: string | null;
  input: SendMessageInput;
  userMessage: Message;
  assistantMessage: Message | null;
  progress: AssistantProgressEvent[];
  status: "streaming" | "error" | "done";
  error?: string;
};

interface AssistantState {
  /** Context chips attached to the next message (campaign / creative / insight / reference). */
  context: ContextChip[];
  addContext: (chip: ContextChip) => void;
  removeContext: (kind: ContextChip["kind"], id: string) => void;
  clearContext: () => void;
  /**
   * The agent the composer is talking to, `AUTO_PERSONA` for an explicit
   * automatic-routing choice, or null when no explicit choice has been made yet.
   *
   * Sticky across route changes: without it the only way to reach a specific
   * agent was a `pendingPrompt` queued from another page, so an ongoing chat
   * silently fell back to the orchestrator on every later message.
   */
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  /** A prompt queued by another page (e.g. Home hero); the assistant page auto-sends it. */
  pendingPrompt: PendingPrompt;
  setPendingPrompt: (p: PendingPrompt) => void;
  stream: ActiveStream | null;
  setStream: (s: ActiveStream | null | ((prev: ActiveStream | null) => ActiveStream | null)) => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  context: [],
  addContext: (chip) =>
    set((s) => ({
      context: s.context.some((c) => c.kind === chip.kind && c.id === chip.id) ? s.context : [...s.context, chip],
    })),
  removeContext: (kind, id) => set((s) => ({ context: s.context.filter((c) => !(c.kind === kind && c.id === id)) })),
  clearContext: () => set({ context: [] }),
  personaId: null,
  setPersonaId: (personaId) => set({ personaId }),
  pendingPrompt: null,
  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
  stream: null,
  setStream: (next) => set((s) => ({ stream: typeof next === "function" ? next(s.stream) : next })),
}));

import { create } from "zustand";
import type { ContextChip, Message, SendMessageInput } from "@/types";

type PendingPrompt = { text: string; context: ContextChip[] } | null;

/** In-flight (streaming) exchange, kept outside React so it survives route changes. */
export type ActiveStream = {
  conversationId: string | null;
  input: SendMessageInput;
  userMessage: Message;
  assistantMessage: Message | null;
  status: "streaming" | "error" | "done";
  error?: string;
};

interface AssistantState {
  /** Context chips attached to the next message (campaign / creative / insight). */
  context: ContextChip[];
  addContext: (chip: ContextChip) => void;
  removeContext: (kind: ContextChip["kind"], id: string) => void;
  clearContext: () => void;
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
  pendingPrompt: null,
  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
  stream: null,
  setStream: (next) => set((s) => ({ stream: typeof next === "function" ? next(s.stream) : next })),
}));

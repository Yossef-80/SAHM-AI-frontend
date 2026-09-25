import type { ActionRef, ActionType } from "@/types";
import { ApiError } from "@/lib/api";
import { getActionDefinition, type ActionContext, type ActionResult } from "./registry";

export class ActionCancelledError extends Error {
  constructor() {
    super("Action cancelled by user");
    this.name = "ActionCancelledError";
  }
}

/**
 * The only way an action runs. Pipeline:
 *   validate payload → prepare (collect missing input) → confirm (if live change) → handler
 * Throws ActionCancelledError if the user backs out; rethrows handler errors for the caller to toast.
 */
export async function dispatchAction(ref: ActionRef | { type: ActionType; payload?: Record<string, unknown> }, ctx: ActionContext): Promise<ActionResult> {
  const def = getActionDefinition(ref.type);
  const parsed = def.payloadSchema.safeParse(ref.payload ?? {});
  if (!parsed.success) {
    throw new ApiError("INVALID_ACTION_PAYLOAD", `Invalid payload for ${ref.type}: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
  }
  let payload: unknown = parsed.data;

  if (def.prepare) {
    const prepared = await def.prepare(payload, ctx);
    if (prepared === null) throw new ActionCancelledError();
    payload = prepared;
  }

  const needsConfirm = typeof def.requiresConfirmation === "function" ? def.requiresConfirmation(payload) : def.requiresConfirmation;
  if (needsConfirm) {
    const diffReq = def.getDiff ? await def.getDiff(payload, ctx) : { title: ctx.t(def.labelKey), diff: [] };
    const ok = await ctx.confirm({ ...diffReq, confirmLabel: ctx.t("confirmApply") });
    if (!ok) throw new ActionCancelledError();
  }

  return def.handler(payload, ctx);
}

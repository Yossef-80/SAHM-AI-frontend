"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { dispatchAction, ActionCancelledError } from "@/lib/actions/dispatch";
import { describeError } from "@/lib/errors";
import type { ActionContext, ActionResult } from "@/lib/actions/registry";
import { useUiStore } from "@/store/ui-store";
import { useAssistantStore } from "@/store/assistant-store";
import type { ActionRef, ActionType } from "@/types";

export type DispatchInput = ActionRef | { type: ActionType; payload?: Record<string, unknown> };

/**
 * The single hook every button uses to run an action.
 * Builds the ActionContext (api, query client, router, i18n, human-in-the-loop dialogs)
 * and handles toasts + navigation from the ActionResult.
 */
export function useAction() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("actions");
  // Error copy lives in its own namespace: the one place that decides how a
  // failed action is described to the user is `describeError`.
  const te = useTranslations("errors");
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const requestPickCampaign = useUiStore((s) => s.requestPickCampaign);
  const setCreateCreative = useUiStore((s) => s.setCreateCreative);
  const setCampaignPrefill = useUiStore((s) => s.setCampaignPrefill);
  const setGeneratedText = useUiStore((s) => s.setGeneratedText);
  const setTextRequest = useUiStore((s) => s.setTextRequest);
  const setPendingPrompt = useAssistantStore((s) => s.setPendingPrompt);
  const [pending, setPending] = useState<ActionType | null>(null);

  const ctx = useMemo<ActionContext>(
    () => ({
      api,
      queryClient,
      navigate: (href) => router.push(href),
      t: (key, values) => t(key, values),
      confirm: (req) => requestConfirm({ ...req, title: req.title, description: req.description }),
      pickCampaign: requestPickCampaign,
      ui: { setCreateCreative, setCampaignPrefill, setGeneratedText, setTextRequest, setPendingPrompt },
    }),
    [queryClient, router, t, requestConfirm, requestPickCampaign, setCreateCreative, setCampaignPrefill, setGeneratedText, setTextRequest, setPendingPrompt],
  );

  const dispatch = useCallback(
    async (input: DispatchInput): Promise<ActionResult | null> => {
      setPending(input.type);
      try {
        const result = await dispatchAction(input, ctx);
        if (result.toastKey) {
          const msg = t(result.toastKey, result.toastValues);
          if (result.ok) toast.success(msg);
          else toast.error(msg);
        }
        if (result.navigateTo) router.push(result.navigateTo);
        return result;
      } catch (err) {
        if (err instanceof ActionCancelledError) {
          toast.info(t("toast.cancelled"));
          return null;
        }
        // `describeError` so a known code gets copy in the user's language
        // instead of the raw English message the API happened to carry.
        toast.error(t("toast.failed", { message: describeError(err, te) }));
        return { ok: false };
      } finally {
        setPending(null);
      }
    },
    [ctx, router, t, te],
  );

  return { dispatch, pending, isPending: pending !== null };
}

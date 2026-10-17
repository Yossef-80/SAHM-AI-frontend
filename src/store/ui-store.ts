import { create } from "zustand";
import type { ChangeDiff, CreativeKind, CampaignDraft, GeneratedText, TextTool } from "@/types";

export type ConfirmRequest = {
  title: string;
  description?: string;
  diff: ChangeDiff[];
  confirmLabel?: string;
  resolve: (ok: boolean) => void;
};

export type PickCampaignRequest = {
  title: string;
  resolve: (campaignId: string | null) => void;
};

interface UiState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  /** Human-in-the-loop confirmation dialog (before/after diff). */
  confirm: ConfirmRequest | null;
  requestConfirm: (req: Omit<ConfirmRequest, "resolve">) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;

  /** Campaign picker used by ADD_TO_CAMPAIGN when no campaign is given. */
  pickCampaign: PickCampaignRequest | null;
  requestPickCampaign: (title: string) => Promise<string | null>;
  resolvePickCampaign: (id: string | null) => void;

  /** Creative "create" dialog request (opened by CREATE_CREATIVE action when no brief is given). */
  createCreative: { kind: CreativeKind; brief?: string; campaignId?: string | null; referenceAnalysisId?: string } | null;
  setCreateCreative: (v: UiState["createCreative"]) => void;

  /** Result of GENERATE_TEXT shown in a dialog. */
  generatedText: GeneratedText | null;
  setGeneratedText: (v: GeneratedText | null) => void;

  /** Cross-route request to open the Layla text dialog with a prefilled brief. */
  textRequest: { tool: TextTool; brief: string; campaignId?: string | null; creativeId?: string | null } | null;
  setTextRequest: (v: UiState["textRequest"]) => void;

  /** Prefill for /campaigns/new coming from CREATE_CAMPAIGN action. */
  campaignPrefill: Partial<CampaignDraft> | null;
  setCampaignPrefill: (v: Partial<CampaignDraft> | null) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  confirm: null,
  requestConfirm: (req) => new Promise<boolean>((resolve) => set({ confirm: { ...req, resolve } })),
  resolveConfirm: (ok) => {
    get().confirm?.resolve(ok);
    set({ confirm: null });
  },

  pickCampaign: null,
  requestPickCampaign: (title) => new Promise<string | null>((resolve) => set({ pickCampaign: { title, resolve } })),
  resolvePickCampaign: (id) => {
    get().pickCampaign?.resolve(id);
    set({ pickCampaign: null });
  },

  createCreative: null,
  setCreateCreative: (createCreative) => set({ createCreative }),

  generatedText: null,
  setGeneratedText: (generatedText) => set({ generatedText }),

  textRequest: null,
  setTextRequest: (textRequest) => set({ textRequest }),

  campaignPrefill: null,
  setCampaignPrefill: (campaignPrefill) => set({ campaignPrefill }),
}));

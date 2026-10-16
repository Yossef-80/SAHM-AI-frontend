"use client";

import { forwardRef, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import {
  AtSign,
  BarChart3,
  BookmarkPlus,
  Bot,
  Building2,
  CalendarDays,
  CheckCheck,
  Compass,
  Crosshair,
  FileText,
  Globe,
  Globe2,
  Images,
  KeyRound,
  Star,
  FolderPlus,
  Gauge,
  Layers,
  Loader2,
  Megaphone,
  Pencil,
  PencilLine,
  Plug,
  ScanSearch,
  Search,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction, type DispatchInput } from "@/hooks/use-action";
import { getActionDefinition } from "@/lib/actions/registry";

const ICONS: Record<string, LucideIcon> = {
  AtSign,
  Bot,
  Building2,
  CalendarDays,
  Compass,
  Crosshair,
  FileText,
  Globe,
  Globe2,
  Images,
  KeyRound,
  Star,
  BarChart3,
  BookmarkPlus,
  CheckCheck,
  FolderPlus,
  Gauge,
  Layers,
  Megaphone,
  Pencil,
  PencilLine,
  Plug,
  ScanSearch,
  Search,
  Sparkles,
  Wand2,
};

type Props = Omit<ComponentProps<typeof Button>, "onClick"> & {
  action: DispatchInput;
  /** Override label; defaults to action.label (from API) or the registry's i18n label. */
  label?: string;
  showIcon?: boolean;
  onDone?: (ok: boolean) => void;
};

/**
 * The only button that runs actions. Never wire a one-off onClick for domain actions —
 * pass an ActionRef here and the registry decides confirmation, API call, toast and navigation.
 */
export const ActionButton = forwardRef<HTMLButtonElement, Props>(function ActionButton(
  { action, label, showIcon = true, onDone, children, disabled, ...rest },
  ref,
) {
  const t = useTranslations("actions");
  const { dispatch, isPending } = useAction();
  const def = getActionDefinition(action.type);
  const Icon = def ? ICONS[def.icon] : null;
  const text = children ?? label ?? ("label" in action && action.label ? action.label : def ? t(def.labelKey) : action.type);

  return (
    <Button
      ref={ref}
      disabled={disabled || isPending}
      onClick={async () => {
        const res = await dispatch(action);
        onDone?.(!!res?.ok);
      }}
      {...rest}
    >
      {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : showIcon && Icon ? <Icon className="me-2 h-4 w-4" /> : null}
      {text}
    </Button>
  );
});

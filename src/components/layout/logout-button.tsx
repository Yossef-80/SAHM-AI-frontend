"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/use-api";
import { describeError } from "@/lib/errors";

export function LogoutButton({
  variant = "ghost",
  size = "sm",
  showLabel = true,
  className = "",
}: {
  variant?: "ghost" | "outline" | "default" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const logout = useLogout();

  const handleSignOut = async () => {
    try {
      await logout.mutateAsync();
    } catch (error) {
      toast.error(describeError(error, te));
    }
    window.location.assign("/login");
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={logout.isPending}
      onClick={() => void handleSignOut()}
      title={t("signOut")}
      aria-label={t("signOut")}
      className={className}
    >
      {logout.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4 shrink-0" />
      )}
      {showLabel && <span className="ms-2">{logout.isPending ? t("signingOut") : t("signOut")}</span>}
    </Button>
  );
}

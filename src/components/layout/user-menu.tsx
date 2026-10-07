"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLogout } from "@/hooks/use-api";
import { useAuthStore } from "@/store/auth-store";
import { describeError } from "@/lib/errors";

/** Identity + sign-out. Name and role come from `/auth/me`, not from a guess. */
export function UserMenu() {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.activeRole);

  const initials = (user?.fullName ?? user?.email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const signOut = async () => {
    try {
      await logout.mutateAsync();
    } catch (error) {
      // The store is cleared either way — a failed logout must not strand the
      // user in an authenticated-looking shell.
      toast.error(describeError(error, te));
    }
    router.replace("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start hover:bg-accent">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[11px]">{initials || "?"}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{user?.fullName ?? user?.email ?? t("signedInAs")}</span>
            {role && <span className="block truncate text-[11px] text-muted-foreground">{t(`role.${role}`)}</span>}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate text-sm">{user?.email ?? t("signedInAs")}</span>
          {role && <span className="block text-[11px] font-normal text-muted-foreground">{t(`role.${role}`)}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} disabled={logout.isPending} className="gap-2">
          <LogOut className="h-4 w-4" />
          {logout.isPending ? t("signingOut") : t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

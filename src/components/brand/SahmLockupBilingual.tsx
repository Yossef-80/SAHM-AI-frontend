import React from "react";
import { SahmIcon } from "./SahmIcon";
import { SahmWordmark } from "./SahmWordmark";

export interface SahmLockupBilingualProps {
  variant?: "gradient" | "white" | "mono";
  className?: string;
}

/**
 * SahmLockupBilingual — MENA lockup: mark, SAHM AI wordmark, then سهم.
 *
 * The Arabic half keeps Cairo (the package's Arabic face); the Latin half now
 * uses the same Outfit 700 / -0.018em as the delivered wordmark instead of the
 * generic extrabold it was approximated with.
 */
export function SahmLockupBilingual({
  variant = "gradient",
  className = "h-9 w-auto",
}: SahmLockupBilingualProps) {
  const arabicColor = variant === "white" ? "text-white" : "text-[#0B0A1A]";
  const wordmarkVariant = variant === "white" ? "white" : variant === "mono" ? "mono" : "gradient";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <SahmIcon variant={variant} className="h-full w-auto aspect-square" />
      <SahmWordmark variant={wordmarkVariant} className="text-xl" />
      <span className="font-light text-gray-400">|</span>
      <span className={`font-['Cairo'] text-xl font-bold ${arabicColor}`}>سهم</span>
    </div>
  );
}

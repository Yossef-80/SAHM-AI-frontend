import React from "react";
import { SahmIcon } from "./SahmIcon";
import { SahmWordmark } from "./SahmWordmark";

export interface SahmLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "gradient" | "white" | "mono" | "indigo";
  className?: string;
  /** Optional chip after the wordmark. Off by default: the name is now "SAHM AI". */
  badge?: string;
}

/**
 * SahmLogo — master horizontal lockup: the mark plus the SAHM AI wordmark.
 * Type and colour are inherited from SahmWordmark so they cannot drift from the
 * delivered logo package.
 */
export function SahmLogo({
  variant = "gradient",
  className = "h-8 w-auto",
  badge,
  ...props
}: SahmLogoProps) {
  return (
    <div {...props} className={`inline-flex items-center gap-2.5 font-sans ${className}`}>
      <SahmIcon variant={variant} className="h-full w-auto aspect-square shrink-0" />
      <div className="flex items-center gap-1.5 leading-none">
        <SahmWordmark variant={variant} className="text-[1.4em]" />
        {badge && (
          <span className="rounded bg-[#FF4D7D]/15 px-1.5 py-0.5 text-[0.6em] font-bold uppercase tracking-wider text-[#FF4D7D]">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

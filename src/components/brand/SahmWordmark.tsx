import React from "react";

export interface SahmWordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Mirrors the delivered lockups: gradient (default), solid indigo, ink, or white. */
  variant?: "gradient" | "indigo" | "mono" | "white";
  className?: string;
}

const SOLID = {
  indigo: "#4B47F2",
  mono: "#0B0A1A",
  white: "#FFFFFF",
} as const;

/**
 * The SAHM AI wordmark.
 *
 * Typeface, weight, tracking and colour come from the delivered logo package,
 * not from an approximation: every lockup is built with
 * `wm_fitted(face_key="outfit", target_h=120, tracking_em=-0.018)` and
 * `WORD_FACES["outfit"] = ("Outfit.ttf", 700)`, and the gradient lockup fills
 * the wordmark with the same three-stop `sahm-grad` as the mark.
 *
 * Verified by re-measuring `sahm-lockup-horizontal-gradient.svg`: its wordmark
 * is 388.52 x 120.00 (ratio 3.2377), which Outfit at wght=700 with -0.018em
 * tracking reproduces to four decimals (3.2376).
 */
export function SahmWordmark({
  variant = "gradient",
  className = "",
  ...props
}: SahmWordmarkProps) {
  const base = "font-outfit font-bold tracking-[-0.018em] leading-none";
  if (variant === "gradient") {
    return (
      <span
        {...props}
        className={`${base} bg-gradient-to-r from-[#4B47F2] via-[#9B34F0] to-[#FF4D7D] bg-clip-text text-transparent ${className}`}
      >
        SAHM AI
      </span>
    );
  }
  return (
    <span {...props} className={`${base} ${className}`} style={{ color: SOLID[variant] }}>
      SAHM AI
    </span>
  );
}

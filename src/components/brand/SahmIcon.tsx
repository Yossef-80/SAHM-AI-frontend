import React from "react";

export interface SahmIconProps extends React.SVGProps<SVGSVGElement> {
  variant?: "gradient" | "white" | "mono" | "indigo";
  className?: string;
}

/**
 * SahmIcon — Standalone Icon Mark of SAHM Marketing OS (سهم).
 * Ascending Growth Chevrons with rounded precision caps.
 */
export function SahmIcon({
  variant = "gradient",
  className = "h-8 w-8",
  ...props
}: SahmIconProps) {
  const stroke =
    variant === "gradient"
      ? "url(#sahm-icon-grad)"
      : variant === "white"
      ? "#FFFFFF"
      : variant === "indigo"
      ? "#4B47F2"
      : "#0B0A1A";

  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {variant === "gradient" && (
        <defs>
          <linearGradient id="sahm-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4B47F2" />
            <stop offset="50%" stopColor="#9B34F0" />
            <stop offset="100%" stopColor="#FF4D7D" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M208 417.28L256 376L304 417.28"
        stroke={stroke}
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M180 329.36L256 264L332 329.36"
        stroke={stroke}
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M152 241.44L256 152L360 241.44"
        stroke={stroke}
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

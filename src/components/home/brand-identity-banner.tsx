"use client";

import Link from "next/link";
import { ArrowRight, Palette, Sparkles, Target } from "lucide-react";
import { useBrandIdentity } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function BrandIdentityBanner() {
  const { data: brand } = useBrandIdentity();

  if (!brand) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-card via-card to-primary/5 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="h-4 w-4" />
            </span>
            <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              {brand.brandName}
            </h3>
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-xs text-primary">
              {brand.industry}
            </Badge>
          </div>

          {brand.essence.tagline && (
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">
              &ldquo;{brand.essence.tagline}&rdquo;
            </p>
          )}

          {/* Palette Preview Swatches */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground mr-1">Brand Colors:</span>
            {[brand.palette.primary, brand.palette.secondary, brand.palette.accent].map((hex, i) => (
              <span
                key={i}
                className="h-4 w-6 rounded border shadow-sm"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
            {brand.swot.strengths.length > 0 && (
              <span className="hidden sm:inline-flex text-xs text-muted-foreground ml-3 items-center gap-1">
                <Target className="h-3 w-3 text-emerald-600" />
                <span className="truncate max-w-[240px]">{brand.swot.strengths[0]}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/brand-identity">
            <Button size="sm" variant="default" className="gap-1.5 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Brand Identity Hub</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

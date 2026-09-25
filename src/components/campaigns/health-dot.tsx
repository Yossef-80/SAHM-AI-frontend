import { cn } from "@/lib/utils";

export function HealthDot({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-destructive";
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {score}
    </span>
  );
}

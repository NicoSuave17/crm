import { cn } from "@/lib/utils";

interface HealthScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md";
}

export function HealthScoreBadge({ score, size = "sm" }: HealthScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  const color =
    score >= 70
      ? "bg-[#00876D]/10 text-[#00876D] dark:bg-[#00876D]/20 dark:text-[#00876D]"
      : score >= 40
        ? "bg-[#FA4616]/10 text-[#FA4616] dark:bg-[#FA4616]/20 dark:text-[#FA4616]"
        : "bg-[#E86644]/10 text-[#E86644] dark:bg-[#E86644]/20 dark:text-[#E86644]";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium",
        color,
        size === "sm" ? "h-6 w-8 text-xs" : "h-8 w-10 text-sm"
      )}
    >
      {score}
    </span>
  );
}

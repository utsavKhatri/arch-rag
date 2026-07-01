import type { RiskLevel, RefactorPriority } from "@/lib/schema"

type Level = RiskLevel | RefactorPriority

const cfg: Record<string, { dot: string; text: string }> = {
  low:      { dot: "bg-[oklch(52%_0.14_145)]", text: "text-[oklch(38%_0.1_145)]"  },
  medium:   { dot: "bg-[oklch(58%_0.14_57)]",  text: "text-[oklch(44%_0.1_57)]"   },
  high:     { dot: "bg-[oklch(55%_0.18_48)]",  text: "text-[oklch(42%_0.14_48)]"  },
  critical: { dot: "bg-[oklch(50%_0.18_22)]",  text: "text-[oklch(38%_0.14_22)]"  },
}

export function RiskBadge({ level }: { level: Level }) {
  const c = cfg[level] ?? cfg.low
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize shrink-0 ${c.text}`}>
      <span className={`size-1.5 rounded-full shrink-0 ${c.dot}`} />
      {level}
    </span>
  )
}

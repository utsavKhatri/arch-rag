"use client"

import { useEffect, useRef } from "react"

function healthMeta(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Healthy",    color: "oklch(52% 0.14 145)" }
  if (score >= 60) return { label: "Fair",       color: "oklch(58% 0.14 57)"  }
  if (score >= 40) return { label: "Needs Work", color: "oklch(58% 0.14 46)"  }
  return                  { label: "At Risk",    color: "oklch(50% 0.18 22)"  }
}

export function MetricsStrip({
  healthScore,
  totalTechDebt,
  criticalIssues,
}: {
  healthScore: number | undefined
  totalTechDebt: number | undefined
  criticalIssues: number | undefined
}) {
  const fillRef = useRef<HTMLDivElement>(null)
  const meta = healthScore !== undefined ? healthMeta(healthScore) : null

  // Depend ONLY on healthScore — meta is a fresh object each render, so listing
  // it here would re-fire (and re-animate from 0%) on every streaming token.
  useEffect(() => {
    const el = fillRef.current
    if (!el || healthScore === undefined) return
    el.style.backgroundColor = healthMeta(healthScore).color
    el.style.width = "0%"
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transition = "width 900ms cubic-bezier(0.16, 1, 0.3, 1)"
        el.style.width = `${healthScore}%`
      })
    )
  }, [healthScore])

  return (
    <div className="space-y-3 pt-1">
      <div className="h-[3px] w-full rounded-full overflow-hidden bg-zinc-100">
        <div ref={fillRef} className="h-full rounded-full" />
      </div>

      <div className="flex items-baseline gap-2 flex-wrap text-sm">
        {meta ? (
          <>
            <span className="font-semibold" style={{ color: meta.color }}>
              {meta.label}
            </span>
            {/* zinc-500 = 4.63:1 on white — passes WCAG AA */}
            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
              {healthScore}/100
            </span>
          </>
        ) : (
          <span className="h-5 w-20 rounded-full animate-pulse bg-zinc-100 inline-block" />
        )}

        <span className="text-zinc-200 px-1 select-none" aria-hidden>|</span>

        {totalTechDebt !== undefined ? (
          <span className="text-zinc-600 text-[13px]">
            <span className="font-medium text-zinc-700 tabular-nums">{totalTechDebt}h</span>
            {" debt"}
          </span>
        ) : (
          <span className="h-4 w-14 rounded-full animate-pulse bg-zinc-100 inline-block" />
        )}

        <span className="text-zinc-200 px-1 select-none" aria-hidden>|</span>

        {criticalIssues !== undefined ? (
          criticalIssues > 0 ? (
            <span className="text-zinc-600 text-[13px]">
              <span className="font-semibold tabular-nums" style={{ color: "oklch(50% 0.18 22)" }}>
                {criticalIssues}
              </span>
              {" critical"}
            </span>
          ) : (
            <span className="text-zinc-500 text-[13px]">no critical issues</span>
          )
        ) : (
          <span className="h-4 w-20 rounded-full animate-pulse bg-zinc-100 inline-block" />
        )}
      </div>
    </div>
  )
}

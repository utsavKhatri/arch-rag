"use client"

import { useEffect, useState } from "react"

const barColor = (score: number) => {
  if (score <= 3) return "bg-emerald-400"
  if (score <= 6) return "bg-amber-400"
  if (score <= 8) return "bg-orange-400"
  return "bg-red-500"
}

export function ComplexityBar({
  score,
  delay = 0,
}: {
  score: number
  delay?: number
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setWidth(score * 10), delay)
    return () => clearTimeout(timer)
  }, [score, delay])

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 w-24 rounded-full bg-zinc-100 overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${barColor(score)}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs text-zinc-500 tabular-nums">
        {score}/10
      </span>
    </div>
  )
}

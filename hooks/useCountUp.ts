"use client"

import { useEffect, useState } from "react"

export function useCountUp(
  target: number | undefined,
  duration = 800
): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === undefined) return

    let animId: number
    const start = performance.now()

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(target * eased))
      if (progress < 1) animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [target, duration])

  return count
}

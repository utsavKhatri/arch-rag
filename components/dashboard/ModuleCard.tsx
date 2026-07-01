import type { Module } from "@/lib/schema"
import { RiskBadge } from "@/components/ui/RiskBadge"
import { ComponentRow } from "./ComponentRow"

const riskAccent: Record<string, string> = {
  critical: "bg-[oklch(99%_0.018_22)] rounded-lg",
  high:     "bg-[oklch(99.2%_0.012_55)] rounded-lg",
  medium:   "",
  low:      "",
}

export function ModuleCard({ module, index }: { module: Partial<Module>; index: number }) {
  const accent = module.risk_level ? (riskAccent[module.risk_level] ?? "") : ""

  return (
    <div className="border-t border-zinc-100 first:border-t-0">
      <div className={`flex items-start gap-4 py-4 px-3 -mx-3 ${accent}`}>
        <span className="shrink-0 font-mono text-[11px] text-zinc-500 tabular-nums pt-[3px] w-5 text-right select-none">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-zinc-900 leading-snug">
                {module.name ?? "Loading…"}
              </h3>
              {module.description && (
                <p className="mt-0.5 text-sm text-zinc-500 leading-snug">
                  {module.description}
                </p>
              )}
            </div>
            {module.risk_level && <RiskBadge level={module.risk_level} />}
          </div>

          {module.components && module.components.length > 0 ? (
            <div className="mt-2 -ml-3">
              {module.components.map((component, i) => (
                <ComponentRow key={i} component={component ?? {}} index={i} />
              ))}
            </div>
          ) : (
            <div className="mt-3 space-y-2 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="h-3.5 rounded-full bg-zinc-100" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

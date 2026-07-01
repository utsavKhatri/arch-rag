"use client"

import { useState } from "react"
import type { Component } from "@/lib/schema"
import { ComplexityBar } from "@/components/ui/ComplexityBar"
import { RiskBadge } from "@/components/ui/RiskBadge"

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={`shrink-0 transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`}
      style={{ color: "oklch(55% 0.006 250)" }}
    >
      <path
        d="M3.5 2L6.5 5L3.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ComponentRow({
  component,
  index,
}: {
  component: Partial<Component>
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  // Filter out LLM "none identified" placeholder strings from real vulnerabilities
  const vulns = (component.security_vulnerabilities ?? []).filter(
    (v) => !/^(none|no |clean|not |n\/a)/i.test(v.trim())
  )
  const recs = component.recommendations ?? []
  const deps = component.dependency_graph ?? []
  const patterns = component.patterns_detected ?? []
  const hasDetails =
    vulns.length > 0 ||
    recs.length > 0 ||
    deps.length > 0 ||
    patterns.length > 0 ||
    component.tech_debt_estimate_hours !== undefined

  return (
    <div>
      <button
        onClick={() => hasDetails && setExpanded((v) => !v)}
        disabled={!hasDetails}
        className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
          hasDetails
            ? "hover:bg-white hover:shadow-[0_1px_3px_oklch(0%_0_0/0.06)] cursor-pointer"
            : "cursor-default"
        }`}
      >
        <span className={hasDetails ? "opacity-60 group-hover:opacity-100 transition-opacity" : "opacity-0"}>
          <Chevron open={expanded} />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-600">
          {component.file_path ?? "—"}
        </span>
        {/* Fixed-width tracks so score and badge align vertically across rows */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex w-[8.75rem] justify-end">
            {component.complexity_score !== undefined && (
              <ComplexityBar score={component.complexity_score} delay={index * 60} />
            )}
          </div>
          <div className="w-[4.5rem]">
            {component.refactor_priority && (
              <RiskBadge level={component.refactor_priority} />
            )}
          </div>
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="mx-3 mb-2 overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-[0_1px_4px_oklch(0%_0_0/0.05)]">
          {/* Summary bar: debt + vuln count */}
          {(component.tech_debt_estimate_hours !== undefined || vulns.length > 0) && (
            <div className="flex items-center gap-4 border-b border-zinc-50 px-3 py-2">
              {component.tech_debt_estimate_hours !== undefined && (
                <span className="text-[11px] text-zinc-400">
                  <span className="font-semibold text-zinc-700 tabular-nums">
                    {component.tech_debt_estimate_hours}h
                  </span>
                  {" debt"}
                </span>
              )}
              {vulns.length > 0 && (
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: "oklch(50% 0.18 22)" }}
                >
                  {vulns.length} vulnerabilit{vulns.length === 1 ? "y" : "ies"}
                </span>
              )}
              {component.name && (
                <span className="ml-auto text-[11px] text-zinc-400 truncate">
                  {component.name}
                </span>
              )}
            </div>
          )}

          <div className="divide-y divide-zinc-50">
            {/* Vulnerabilities */}
            {vulns.length > 0 && (
              <div className="px-3 py-2.5 space-y-1.5">
                {vulns.map((v, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span
                      className="shrink-0 font-bold leading-[1.4]"
                      style={{ color: "oklch(50% 0.18 22)" }}
                    >
                      !
                    </span>
                    <span className="text-zinc-700 leading-relaxed">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {recs.length > 0 && (
              <div className="px-3 py-2.5 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Recommendations
                </span>
                <ol className="mt-1.5 space-y-1.5">
                  {recs.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs text-zinc-600 leading-relaxed">
                      <span className="shrink-0 tabular-nums text-zinc-500 w-3">{i + 1}.</span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Dependencies + Patterns */}
            {(deps.length > 0 || patterns.length > 0) && (
              <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
                {deps.map((d, i) => (
                  <span
                    key={`d${i}`}
                    className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500"
                  >
                    {d}
                  </span>
                ))}
                {patterns.map((p, i) => (
                  <span
                    key={`p${i}`}
                    className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 italic"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

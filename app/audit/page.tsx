"use client"

import { experimental_useObject as useObject } from "@ai-sdk/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { AuditHeader } from "@/components/dashboard/AuditHeader"
import { MetricsStrip } from "@/components/dashboard/MetricsStrip"
import { ModuleCard } from "@/components/dashboard/ModuleCard"
import { SkeletonCard } from "@/components/ui/SkeletonCard"
import { AuditSchema, type Audit } from "@/lib/schema"

function AuditPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session") ?? ""
  const model = searchParams.get("model") ?? ""
  const provider = (searchParams.get("provider") ?? "ollama") as "ollama" | "gemini"

  // Cache the finished audit so revisiting the URL (reload, back/forward) is
  // instant and costs no LLM call. Keyed by model+provider so changing either
  // correctly triggers a fresh audit.
  const cacheKey = `audit-${sessionId}-${provider}-${model}`

  const hasSubmitted = useRef(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [cached, setCached] = useState<Audit | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (provider === "gemini") {
      setApiKey(sessionStorage.getItem(`gemini-key-${sessionId}`) ?? "")
    } else {
      setApiKey("")
    }
  }, [sessionId, provider])

  // Read any cached result for this exact session+model+provider.
  useEffect(() => {
    if (sessionId && model) {
      try {
        const raw = sessionStorage.getItem(cacheKey)
        if (raw) setCached(JSON.parse(raw) as Audit)
      } catch {
        /* corrupt/quota — ignore, fall through to a fresh audit */
      }
    }
    setHydrated(true)
  }, [cacheKey, sessionId, model])

  const { object, isLoading, error, submit } = useObject({
    api: "/api/audit",
    schema: AuditSchema,
    onFinish: ({ object }) => {
      // Persist only fully-validated results; partial/errored streams aren't cached.
      if (object) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(object))
        } catch {
          /* quota exceeded — skip caching, audit still renders */
        }
      }
    },
  })

  useEffect(() => {
    if (!hydrated || hasSubmitted.current) return
    if (!sessionId || !model || apiKey === null) return
    // No client key for Gemini is fine — the server falls back to GEMINI_API_KEY
    // (the home page already ensured a key exists somewhere before navigating here).
    hasSubmitted.current = true
    if (cached) return // cache hit — render it, skip the LLM call
    submit({ sessionId, model, provider, apiKey: apiKey || undefined })
  }, [hydrated, cached, sessionId, model, provider, apiKey, submit])

  // Live stream takes precedence while running; otherwise show the cached result.
  const display = object ?? cached

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3 text-center">
          <p className="text-sm text-zinc-500">No session found.</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm font-medium text-zinc-900 underline underline-offset-4"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  if (!isLoading && error && !display) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            ← New audit
          </button>
          <div className="border-t border-zinc-100 pt-5 space-y-2">
            <p className="font-semibold text-zinc-900">Audit failed</p>
            <p className="text-sm text-zinc-500 max-w-[52ch]">{error.message}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-2 inline-block text-sm font-medium text-zinc-700 underline underline-offset-4"
            >
              Start a new audit
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors shrink-0"
          >
            ← New audit
          </button>
          <div className="flex items-center gap-3 min-w-0">
            {model && (
              <span className="font-mono text-[11px] text-zinc-500 truncate">{model}</span>
            )}
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
                <span className="size-1.5 rounded-full bg-zinc-400 animate-pulse" />
                Streaming
              </span>
            )}
            {error && display && (
              <span className="text-xs text-red-500 shrink-0">Stream interrupted</span>
            )}
          </div>
        </div>

        <MetricsStrip
          healthScore={display?.health_score}
          totalTechDebt={display?.total_tech_debt_hours}
          criticalIssues={display?.critical_issues_count}
        />

        <AuditHeader summary={display?.executive_summary} />

        <div className="mt-6">
          {display?.modules?.map((module, i: number) => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <ModuleCard key={i} module={(module ?? {}) as any} index={i} />
          ))}
          {isLoading && <SkeletonCard />}
        </div>

        {!isLoading && !error && display?.modules && display.modules.length > 0 && (
          <p className="text-xs text-zinc-500 pb-8 pt-4 border-t border-zinc-100">
            {display.modules.length} modules &middot;{" "}
            {display.modules.reduce(
              (a: number, m) => a + (m?.components?.length ?? 0),
              0
            )}{" "}
            components &middot; {provider === "gemini" ? "Gemini" : "Ollama"}
          </p>
        )}
      </div>
    </div>
  )
}

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <div className="space-y-3 w-full max-w-4xl px-4">
            <div className="h-20 rounded-xl bg-white border border-zinc-200 animate-pulse" />
            <div className="h-32 rounded-xl bg-white border border-zinc-200 animate-pulse" />
            <div className="h-48 rounded-xl bg-white border border-zinc-200 animate-pulse" />
          </div>
        </div>
      }
    >
      <AuditPageInner />
    </Suspense>
  )
}

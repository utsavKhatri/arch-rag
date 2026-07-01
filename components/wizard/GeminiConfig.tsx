"use client"

const GEMINI_MODELS = [
  { id: "gemini-3.5-flash",      label: "Gemini 3.5 Flash — latest, best reasoning (recommended)" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite — fastest, lowest cost" },
  { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash — stable, price-performance" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite — budget, high-throughput" },
  { id: "gemini-2.5-pro",        label: "Gemini 2.5 Pro — most powerful, complex audits" },
]

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id

export function GeminiConfig({
  model,
  onModelChange,
  apiKey,
  onApiKeyChange,
  serverKeyConfigured,
}: {
  model: string
  onModelChange: (m: string) => void
  apiKey: string
  onApiKeyChange: (k: string) => void
  serverKeyConfigured: boolean | null
}) {
  const probing = serverKeyConfigured === null
  const hasServerKey = serverKeyConfigured === true
  const overriding = hasServerKey && apiKey.length > 0

  return (
    <div className="space-y-3">
      <select
        value={model || DEFAULT_GEMINI_MODEL}
        onChange={(e) => onModelChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all"
      >
        {GEMINI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      <div className="space-y-1.5">
        <div className="relative">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={
              hasServerKey ? "Override server key (optional)" : "Gemini API key (AIza…)"
            }
            autoComplete="new-password"
            data-lpignore="true"
            data-form-type="other"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 pr-24 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all"
          />
          {/* Status pill — only meaningful once we've probed the server */}
          {!probing && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium">
              {hasServerKey ? (
                overriding ? (
                  <span className="text-zinc-400">overriding</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[oklch(45%_0.13_150)]">
                    <span className="size-1.5 rounded-full bg-[oklch(60%_0.15_150)]" />
                    server key
                  </span>
                )
              ) : (
                <span className="text-[oklch(55%_0.16_50)]">required</span>
              )}
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-400">
          {probing
            ? "Checking server configuration…"
            : hasServerKey
              ? overriding
                ? "Using the key you entered for this run instead of the server key."
                : "A key is set in the server .env — leave blank to use it, or enter one to override."
              : "Stored in sessionStorage only, sent only to Google. Add GEMINI_API_KEY to .env to skip this."}
        </p>
      </div>
    </div>
  )
}

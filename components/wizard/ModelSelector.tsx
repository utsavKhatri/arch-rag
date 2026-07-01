"use client"

import { useEffect, useState } from "react"

interface ModelOption {
  name: string
  parameterSize: string | null
}

const PREFERRED_DEFAULTS = ["gemma4:2b", "llama3.1:8b"]

function pickDefault(models: ModelOption[]): string {
  for (const preferred of PREFERRED_DEFAULTS) {
    if (models.find((m) => m.name === preferred)) return preferred
  }
  return models[0]?.name ?? ""
}

export function ModelSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (model: string) => void
}) {
  const [models, setModels] = useState<ModelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models: ModelOption[]; error?: string }) => {
        setModels(data.models)
        if (data.error) setWarning(data.error)
        if (data.models.length > 0 && !value) {
          onChange(pickDefault(data.models))
        }
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="h-11 w-full animate-pulse rounded-lg bg-zinc-100" />
    )
  }

  return (
    <div className="space-y-2">
      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {warning}
        </div>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={models.length === 0}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all disabled:opacity-50"
      >
        {models.length === 0 && (
          <option value="">No models available</option>
        )}
        {models.map((m) => (
          <option key={m.name} value={m.name}>
            {m.name}
            {m.parameterSize ? ` (${m.parameterSize})` : ""}
          </option>
        ))}
      </select>
    </div>
  )
}

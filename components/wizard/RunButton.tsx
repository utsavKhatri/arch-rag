"use client"

import { useState } from "react"
import type { SourceType } from "./SourceSelector"

interface Props {
  sourceType: SourceType
  files: File[]
  directoryPath: string
  gitUrl: string
  model: string
  provider: "ollama" | "gemini"
  apiKey: string
  serverKeyConfigured?: boolean | null
  onSuccess: (sessionId: string) => void
  onBusyChange?: (busy: boolean) => void
}

interface Progress {
  message: string
  percent: number
}

function isReady(
  sourceType: SourceType,
  files: File[],
  directoryPath: string,
  gitUrl: string,
  model: string,
  provider: "ollama" | "gemini",
  apiKey: string,
  serverKeyConfigured: boolean | null
): boolean {
  if (!model) return false
  // Gemini needs a key from somewhere — typed in the UI or present in server .env.
  if (provider === "gemini" && !apiKey && !serverKeyConfigured) return false
  if (sourceType === "upload") return files.length > 0
  if (sourceType === "directory")
    return directoryPath.startsWith("/") || !!directoryPath.match(/^[A-Za-z]:\\/)
  if (sourceType === "git")
    return gitUrl.startsWith("https://") || gitUrl.startsWith("git@")
  return false
}

export function RunButton({
  sourceType,
  files,
  directoryPath,
  gitUrl,
  model,
  provider,
  apiKey,
  serverKeyConfigured = null,
  onSuccess,
  onBusyChange,
}: Props) {
  const [state, setState] = useState<"idle" | "indexing" | "error">("idle")
  const [progress, setProgress] = useState<Progress>({ message: "", percent: 0 })
  const [errorMsg, setErrorMsg] = useState("")

  const ready = isReady(sourceType, files, directoryPath, gitUrl, model, provider, apiKey, serverKeyConfigured)

  async function handleRun() {
    setState("indexing")
    onBusyChange?.(true)
    setProgress({ message: "Starting…", percent: 0 })
    setErrorMsg("")

    try {
      let response: Response

      if (sourceType === "upload") {
        const formData = new FormData()
        files.forEach((f) => formData.append("files", f))
        response = await fetch("/api/index", { method: "POST", body: formData })
      } else {
        response = await fetch("/api/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: sourceType,
            path: sourceType === "directory" ? directoryPath : gitUrl,
          }),
        })
      }

      if (!response.body) throw new Error("No response body from server")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split("\n").filter((l) => l.startsWith("data: "))

        for (const line of lines) {
          let data: { type: string; message?: string; percent?: number; sessionId?: string }
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (data.type === "progress") {
            setProgress({ message: data.message ?? "", percent: data.percent ?? 0 })
          } else if (data.type === "done") {
            onSuccess(data.sessionId ?? "")
            return
          } else if (data.type === "error") {
            setState("error")
            setErrorMsg(data.message ?? "Unknown error")
            onBusyChange?.(false)
            return
          }
        }
      }

      // Stream ended without a done/error event — don't leave the UI stuck.
      setState("error")
      setErrorMsg("Indexing ended unexpectedly. Please try again.")
      onBusyChange?.(false)
    } catch (err) {
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error")
      onBusyChange?.(false)
    }
  }

  if (state === "indexing") {
    return (
      <div className="space-y-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-900 transition-[width] duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="text-sm text-zinc-500">{progress.message}</p>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      {state === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      <button
        onClick={handleRun}
        disabled={!ready}
        className="w-full rounded-xl bg-zinc-900 px-6 py-3.5 text-sm font-medium text-white transition-all hover:bg-zinc-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
      >
        {state === "error" ? "Try Again" : "Run Audit →"}
      </button>
    </div>
  )
}

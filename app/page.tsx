"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FileDropzone } from "@/components/wizard/FileDropzone"
import { DirectoryInput } from "@/components/wizard/DirectoryInput"
import { GitInput } from "@/components/wizard/GitInput"
import { GeminiConfig, DEFAULT_GEMINI_MODEL } from "@/components/wizard/GeminiConfig"
import { ModelSelector } from "@/components/wizard/ModelSelector"
import { RunButton } from "@/components/wizard/RunButton"
import { SourceSelector, type SourceType } from "@/components/wizard/SourceSelector"

const PROVIDER_TABS = [
  { id: "ollama" as const, label: "Ollama (local)" },
  { id: "gemini" as const, label: "Gemini (cloud)" },
]

export default function WizardPage() {
  const router = useRouter()

  const [sourceType, setSourceType] = useState<SourceType>("upload")
  const [files, setFiles] = useState<File[]>([])
  const [directoryPath, setDirectoryPath] = useState("")
  const [gitUrl, setGitUrl] = useState("")
  const [provider, setProvider] = useState<"ollama" | "gemini">("ollama")
  const [model, setModel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [busy, setBusy] = useState(false)
  // null = still probing the server; true/false once known.
  const [serverKeyConfigured, setServerKeyConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    if (provider === "gemini" && !model) {
      setModel(DEFAULT_GEMINI_MODEL)
    }
  }, [provider, model])

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { geminiKeyConfigured?: boolean }) =>
        setServerKeyConfigured(!!d.geminiKeyConfigured)
      )
      .catch(() => setServerKeyConfigured(false))
  }, [])

  function handleSuccess(sessionId: string) {
    if (provider === "gemini" && apiKey) {
      sessionStorage.setItem(`gemini-key-${sessionId}`, apiKey)
    }
    router.push(
      `/audit?session=${sessionId}&model=${encodeURIComponent(model)}&provider=${provider}`
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-xl space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Arch-RAG
          </h1>
          <p className="text-sm text-zinc-500">
            Architectural intelligence. 100% local embedding — zero code leaves your machine.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
          {/* Config — disabled as a unit while indexing so source/provider/model
              can't change mid-run (which would desync the navigation params). */}
          <fieldset
            disabled={busy}
            className={`m-0 min-w-0 space-y-6 border-0 p-0 transition-opacity ${
              busy ? "opacity-50" : ""
            }`}
          >
            {/* Source */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-zinc-700">
                Codebase source
              </label>
              <SourceSelector value={sourceType} onChange={setSourceType} />
              <div className="pt-1">
                {sourceType === "upload" && (
                  <FileDropzone files={files} onChange={setFiles} disabled={busy} />
                )}
                {sourceType === "directory" && (
                  <DirectoryInput value={directoryPath} onChange={setDirectoryPath} />
                )}
                {sourceType === "git" && (
                  <GitInput value={gitUrl} onChange={setGitUrl} />
                )}
              </div>
            </div>

            <div className="border-t border-zinc-100" />

            {/* Provider + Model */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-zinc-700">
                Inference provider
              </label>
              <div className="relative flex gap-0 border border-zinc-200 rounded-lg p-1 bg-zinc-50">
                {PROVIDER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setProvider(tab.id)}
                    className={`relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed ${
                      provider === tab.id
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {provider === "ollama" && (
                <ModelSelector value={model} onChange={setModel} />
              )}
              {provider === "gemini" && (
                <GeminiConfig
                  model={model}
                  onModelChange={setModel}
                  apiKey={apiKey}
                  onApiKeyChange={setApiKey}
                  serverKeyConfigured={serverKeyConfigured}
                />
              )}
            </div>
          </fieldset>

          {/* CTA */}
          <RunButton
            sourceType={sourceType}
            files={files}
            directoryPath={directoryPath}
            gitUrl={gitUrl}
            model={model}
            provider={provider}
            apiKey={apiKey}
            serverKeyConfigured={serverKeyConfigured}
            onSuccess={handleSuccess}
            onBusyChange={setBusy}
          />
        </div>

        <p className="text-center text-xs text-zinc-400">
          Embeddings: local (all-MiniLM-L6-v2) · ChromaDB on :8000
          {provider === "ollama" && " · Ollama on :11434"}
        </p>
      </div>
    </div>
  )
}

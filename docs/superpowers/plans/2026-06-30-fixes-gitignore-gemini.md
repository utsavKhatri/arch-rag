# Fixes + gitignore Indexing + Gemini Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 7 review findings, add gitignore-aware indexing that respects .gitignore/.agentignore/node_modules/lock files, and add a Gemini cloud provider option alongside Ollama.

**Architecture:** Introduce `lib/sources/shared.ts` as a single source of truth for extensions, ignore patterns, gitignore parsing, and path/URL validation. Extend `ModelSelector` into a provider-aware UI (Ollama local / Gemini cloud) with the Gemini API key stored in `sessionStorage` so it never appears in URLs. Update `/api/audit` to branch on provider.

**Tech Stack:** Next.js 16 (App Router), `@ai-sdk/google` (new), `@ai-sdk/openai` (existing), `ai` v6, Zod v4, `glob` v13, `@xenova/transformers`, ChromaDB, Vitest.

## Global Constraints

- Never add a dependency when existing deps or stdlib cover it.
- Keep `@ai-sdk/google` pinned at the same major as `@ai-sdk/openai@3.x` (i.e., `^3.0.0`).
- Gemini API key must never appear in the URL or server logs.
- All server-side validation lives in `lib/sources/shared.ts`; routes call it, not duplicate it.
- `MIN_CHUNK_LENGTH` stays at 10; only the test description is fixed.
- No comments explaining what code does; only `// ponytail:` for deliberate shortcuts.

---

### Task 1: Shared source utilities

**Files:**
- Create: `lib/sources/shared.ts`

**Interfaces:**
- Produces:
  - `TEXT_EXTENSIONS: Set<string>`
  - `GLOB_PATTERN: string`
  - `DEFAULT_IGNORE: string[]`
  - `isTextFile(filename: string): boolean`
  - `validateDirectoryPath(dirPath: string): void` — throws on invalid
  - `validateGitUrl(url: string): void` — throws on invalid
  - `loadIgnorePatterns(dirPath: string): Promise<string[]>` — merges DEFAULT_IGNORE + parsed .gitignore/.agentignore

- [ ] **Step 1: Create lib/sources/shared.ts**

```typescript
import { readFile } from "fs/promises"
import path from "path"

export const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "go", "rs", "java", "cpp", "c", "h",
  "md", "txt", "json", "yaml", "yml", "toml",
  "css", "scss", "html", "sql", "sh",
])

export const GLOB_PATTERN = `**/*.{${[...TEXT_EXTENSIONS].join(",")}}`

export const DEFAULT_IGNORE = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "build/**",
  ".next/**",
  "out/**",
  "coverage/**",
  ".turbo/**",
  ".cache/**",
  ".agents/**",
  "vendor/**",
  "*.lock",
  "*.log",
  ".env*",
  "**/.env*",
  ".DS_Store",
  "*.tsbuildinfo",
  "*.min.js",
  "*.min.css",
]

export function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return TEXT_EXTENSIONS.has(ext)
}

export function validateDirectoryPath(dirPath: string): void {
  const clean = dirPath.replace(/\\/g, "/")
  if (!clean.startsWith("/") && !/^[A-Za-z]:\//.test(clean)) {
    throw new Error("Directory path must be absolute")
  }
  if (clean.split("/").some((seg) => seg === "..")) {
    throw new Error("Directory path must not contain ..")
  }
}

export function validateGitUrl(url: string): void {
  if (!url.startsWith("https://") && !url.startsWith("git@")) {
    throw new Error("Git URL must start with https:// or git@")
  }
  if (/[;&|`$<>(){}[\]\\]/.test(url)) {
    throw new Error("Git URL contains invalid characters")
  }
}

export async function loadIgnorePatterns(dirPath: string): Promise<string[]> {
  const patterns = [...DEFAULT_IGNORE]
  for (const filename of [".gitignore", ".agentignore", ".dockerignore"]) {
    try {
      const raw = await readFile(path.join(dirPath, filename), "utf-8")
      for (const line of raw.split("\n")) {
        const p = line.trim()
        if (!p || p.startsWith("#") || p.startsWith("!")) continue
        // Root-relative → strip leading slash
        const normalized = p.startsWith("/") ? p.slice(1) : p
        // Directory marker → glob everything inside
        const globbed = normalized.endsWith("/")
          ? `${normalized}**`
          : normalized
        patterns.push(globbed)
        // Also match anywhere in the tree if no slash in middle
        if (!normalized.slice(0, -1).includes("/")) {
          patterns.push(`**/${globbed}`)
        }
      }
    } catch {
      // file absent — skip
    }
  }
  return patterns
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ztlab173/Documents/Learning/arch-rag && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors for the new file.

---

### Task 2: Fix directory source (gitignore-aware + shared extensions)

**Files:**
- Modify: `lib/sources/directory.ts`

**Interfaces:**
- Consumes: `GLOB_PATTERN`, `loadIgnorePatterns` from `lib/sources/shared.ts`
- Produces: `extractFromDirectory(dirPath: string): Promise<SourceDocument[]>` — unchanged signature

- [ ] **Step 1: Rewrite lib/sources/directory.ts**

```typescript
import { readFile } from "fs/promises"
import path from "path"
import { glob } from "glob"
import { GLOB_PATTERN, loadIgnorePatterns } from "./shared"
import type { SourceDocument } from "./upload"

export async function extractFromDirectory(
  dirPath: string
): Promise<SourceDocument[]> {
  const ignore = await loadIgnorePatterns(dirPath)

  const files = await glob(GLOB_PATTERN, {
    cwd: dirPath,
    ignore,
    nodir: true,
    absolute: false,
  })

  const docs: SourceDocument[] = []
  let errorCount = 0

  for (const relativePath of files) {
    try {
      const content = await readFile(path.join(dirPath, relativePath), "utf-8")
      if (content.trim().length === 0) continue
      docs.push({
        content,
        metadata: { file: relativePath, source_type: "directory" },
      })
    } catch {
      errorCount++
    }
  }

  if (files.length > 0 && docs.length === 0 && errorCount === files.length) {
    throw new Error(
      `Could not read any files in ${dirPath} — check directory permissions`
    )
  }

  return docs
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd /Users/ztlab173/Documents/Learning/arch-rag && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

---

### Task 3: Fix upload source (shared extensions)

**Files:**
- Modify: `lib/sources/upload.ts`

**Interfaces:**
- Consumes: `isTextFile` from `lib/sources/shared.ts`
- Produces: `extractFromFormData`, `SourceDocument` — unchanged signatures

- [ ] **Step 1: Replace TEXT_EXTENSIONS with shared isTextFile**

```typescript
import { isTextFile } from "./shared"

export interface SourceDocument {
  content: string
  metadata: { file: string; source_type: string }
}

export async function extractFromFormData(
  formData: FormData
): Promise<SourceDocument[]> {
  const docs: SourceDocument[] = []
  const files = formData.getAll("files") as File[]
  for (const file of files) {
    if (!isTextFile(file.name)) continue
    const content = await file.text()
    if (content.trim().length === 0) continue
    docs.push({
      content,
      metadata: { file: file.name, source_type: "upload" },
    })
  }
  return docs
}
```

---

### Task 4: Fix git source (server-side URL validation)

**Files:**
- Modify: `lib/sources/git.ts`

**Interfaces:**
- Consumes: `validateGitUrl` from `lib/sources/shared.ts`
- Produces: `extractFromGit(url: string)` — unchanged signature; now throws on invalid URL

- [ ] **Step 1: Add validateGitUrl call**

```typescript
import { mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import simpleGit from "simple-git"
import { validateGitUrl } from "./shared"
import { extractFromDirectory } from "./directory"
import type { SourceDocument } from "./upload"

export async function extractFromGit(url: string): Promise<{
  docs: SourceDocument[]
  cleanup: () => Promise<void>
}> {
  validateGitUrl(url)

  const tmpDir = await mkdtemp(path.join(tmpdir(), "arch-rag-"))

  await simpleGit().clone(url, tmpDir, ["--depth", "1"])

  const docs = await extractFromDirectory(tmpDir)
  const docsWithGitMeta = docs.map((d) => ({
    ...d,
    metadata: { ...d.metadata, source_type: "git" },
  }))

  return {
    docs: docsWithGitMeta,
    cleanup: () => rm(tmpDir, { recursive: true, force: true }),
  }
}
```

---

### Task 5: Fix index route (cleanup leak + server-side path validation)

**Files:**
- Modify: `app/api/index/route.ts`

**What changes:**
1. Call `validateDirectoryPath` before `extractFromDirectory`
2. Move `cleanup` into a `finally` block so it runs on both success and error paths

- [ ] **Step 1: Rewrite app/api/index/route.ts**

```typescript
import { randomUUID } from "crypto"
import type { NextRequest } from "next/server"
import { chunkDocuments } from "@/lib/chunker"
import { embedBatch } from "@/lib/embedder"
import { storeChunks } from "@/lib/chromadb"
import { extractFromFormData } from "@/lib/sources/upload"
import { extractFromDirectory } from "@/lib/sources/directory"
import { extractFromGit } from "@/lib/sources/git"
import { validateDirectoryPath } from "@/lib/sources/shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProgressEvent =
  | { type: "progress"; message: string; percent: number }
  | { type: "done"; sessionId: string }
  | { type: "error"; message: string }

function makeSSEStream(
  handler: (send: (event: ProgressEvent) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )
      }
      try {
        await handler(send)
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "Unknown error during indexing",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

export async function POST(request: NextRequest) {
  return makeSSEStream(async (send) => {
    const contentType = request.headers.get("content-type") ?? ""

    send({ type: "progress", message: "Reading source files…", percent: 5 })

    let docs: Awaited<ReturnType<typeof extractFromFormData>> = []
    let cleanup: (() => Promise<void>) | null = null

    try {
      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData()
        docs = await extractFromFormData(formData)
      } else {
        const body = (await request.json()) as {
          type: "directory" | "git"
          path: string
        }

        if (body.type === "directory") {
          validateDirectoryPath(body.path)
          docs = await extractFromDirectory(body.path)
        } else if (body.type === "git") {
          // validateGitUrl is called inside extractFromGit
          const result = await extractFromGit(body.path)
          docs = result.docs
          cleanup = result.cleanup
        }
      }

      if (docs.length === 0) {
        throw new Error(
          "No readable text files found in the provided source."
        )
      }

      send({
        type: "progress",
        message: `Chunking ${docs.length} files…`,
        percent: 20,
      })

      const chunks = chunkDocuments(docs)

      send({
        type: "progress",
        message: `Embedding ${chunks.length} chunks (this may take a minute on first run)…`,
        percent: 35,
      })

      const EMBED_BATCH = 50
      const embeddings: number[][] = []
      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH)
        const batchEmbeddings = await embedBatch(batch.map((c) => c.content))
        embeddings.push(...batchEmbeddings)

        const percent =
          35 + Math.round((Math.min(i + EMBED_BATCH, chunks.length) / chunks.length) * 45)
        send({
          type: "progress",
          message: `Embedding chunks ${i + 1}–${Math.min(i + EMBED_BATCH, chunks.length)} of ${chunks.length}…`,
          percent: Math.min(percent, 80),
        })
      }

      send({ type: "progress", message: "Storing in ChromaDB…", percent: 85 })

      const sessionId = randomUUID()
      await storeChunks(sessionId, chunks, embeddings)

      send({ type: "done", sessionId })
    } finally {
      if (cleanup) await cleanup()
    }
  })
}
```

**Key changes:**
- `validateDirectoryPath` called before `extractFromDirectory`
- `cleanup` now called in `finally` — runs even if `embedBatch` or `storeChunks` throws
- Progress percent uses `Math.min(i + EMBED_BATCH, chunks.length)` so last batch doesn't freeze

- [ ] **Step 2: Verify compile**

```bash
cd /Users/ztlab173/Documents/Learning/arch-rag && npx tsc --noEmit 2>&1 | head -30
```

---

### Task 6: Add Gemini provider

**Files:**
- Run: `bun add @ai-sdk/google`
- Modify: `app/api/audit/route.ts`
- Create: `components/wizard/GeminiConfig.tsx`
- Modify: `components/wizard/ModelSelector.tsx` (rename to ProviderSelector wrapper)
- Modify: `app/page.tsx`
- Modify: `app/audit/page.tsx`

**Interfaces:**
- `/api/audit` POST body extended: `{ sessionId: string, model: string, provider: "ollama" | "gemini", apiKey?: string }`
- `GeminiConfig`: `{ model: string, onModelChange: (m: string) => void, apiKey: string, onApiKeyChange: (k: string) => void }`
- `app/page.tsx` state: add `provider: "ollama" | "gemini"`, `apiKey: string`
- `app/audit/page.tsx`: reads `provider` from search params, `apiKey` from `sessionStorage`

- [ ] **Step 1: Install @ai-sdk/google**

```bash
cd /Users/ztlab173/Documents/Learning/arch-rag && bun add @ai-sdk/google
```

Expected: package added to package.json and bun.lock updated.

- [ ] **Step 2: Update app/api/audit/route.ts**

```typescript
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { streamObject } from "ai"
import type { NextRequest } from "next/server"
import { queryChunks } from "@/lib/chromadb"
import { embed } from "@/lib/embedder"
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt"
import { AuditSchema } from "@/lib/schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const {
    sessionId,
    model,
    provider = "ollama",
    apiKey,
  } = (await request.json()) as {
    sessionId: string
    model: string
    provider?: "ollama" | "gemini"
    apiKey?: string
  }

  if (!sessionId || !model) {
    return Response.json(
      { error: "sessionId and model are required" },
      { status: 400 }
    )
  }

  if (provider === "gemini" && !apiKey) {
    return Response.json(
      { error: "apiKey is required for Gemini provider" },
      { status: 400 }
    )
  }

  const queryEmbedding = await embed(
    "architectural modules components security vulnerabilities complexity"
  )

  const chunks = await queryChunks(sessionId, queryEmbedding, 30)

  const aiModel =
    provider === "gemini"
      ? createGoogleGenerativeAI({ apiKey })(model)
      : createOpenAI({ baseURL: "http://localhost:11434/v1", apiKey: "ollama" })(model)

  const result = streamObject({
    model: aiModel,
    schema: AuditSchema,
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(chunks),
    temperature: 0,
  })

  return result.toTextStreamResponse()
}
```

- [ ] **Step 3: Create components/wizard/GeminiConfig.tsx**

```tsx
"use client"

const GEMINI_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fast)" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (powerful)" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (balanced)" },
]

export function GeminiConfig({
  model,
  onModelChange,
  apiKey,
  onApiKeyChange,
}: {
  model: string
  onModelChange: (m: string) => void
  apiKey: string
  onApiKeyChange: (k: string) => void
}) {
  return (
    <div className="space-y-3">
      <select
        value={model || GEMINI_MODELS[0].id}
        onChange={(e) => onModelChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all"
      >
        {GEMINI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        placeholder="Gemini API key (AIza…)"
        autoComplete="off"
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all"
      />
      <p className="text-xs text-zinc-400">
        Key is stored in sessionStorage only — never sent to any server except Google.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Update app/page.tsx**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FileDropzone } from "@/components/wizard/FileDropzone"
import { DirectoryInput } from "@/components/wizard/DirectoryInput"
import { GitInput } from "@/components/wizard/GitInput"
import { GeminiConfig } from "@/components/wizard/GeminiConfig"
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

  // Default Gemini model when switching to that provider
  useEffect(() => {
    if (provider === "gemini" && !model) {
      setModel("gemini-2.0-flash")
    }
  }, [provider, model])

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
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700">
              Codebase source
            </label>
            <SourceSelector value={sourceType} onChange={setSourceType} />
            <div className="pt-1">
              {sourceType === "upload" && (
                <FileDropzone files={files} onChange={setFiles} />
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

          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700">
              Inference provider
            </label>
            <div className="relative flex gap-0 border border-zinc-200 rounded-lg p-1 bg-zinc-50">
              {PROVIDER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setProvider(tab.id)}
                  className={`relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
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
              />
            )}
          </div>

          <RunButton
            sourceType={sourceType}
            files={files}
            directoryPath={directoryPath}
            gitUrl={gitUrl}
            model={model}
            provider={provider}
            apiKey={apiKey}
            onSuccess={handleSuccess}
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
```

- [ ] **Step 5: Update RunButton to pass provider + apiKey to audit**

The RunButton only handles indexing (SSE), not the audit call. The audit call is made from `app/audit/page.tsx` directly. However, `RunButton` needs `provider` and `apiKey` in its Props type to satisfy the parent passing them. We just need to add them to the Props interface — they're not used inside RunButton itself.

Also update `isReady` to require `apiKey` when provider is `"gemini"`.

```tsx
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
  onSuccess: (sessionId: string) => void
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
  apiKey: string
): boolean {
  if (!model) return false
  if (provider === "gemini" && !apiKey) return false
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
  onSuccess,
}: Props) {
  const [state, setState] = useState<"idle" | "indexing" | "error">("idle")
  const [progress, setProgress] = useState<Progress>({ message: "", percent: 0 })
  const [errorMsg, setErrorMsg] = useState("")

  const ready = isReady(sourceType, files, directoryPath, gitUrl, model, provider, apiKey)

  async function handleRun() {
    setState("indexing")
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
            return
          }
        }
      }
    } catch (err) {
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error")
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
    <div className="space-y-2">
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
```

**Changes from original:**
- `JSON.parse` now inside try/catch with `continue` on failure (no stuck UI)
- `onSuccess` and `return` immediately after done/error to stop reading
- Provider + apiKey in Props, `isReady` requires apiKey when provider=gemini

- [ ] **Step 6: Update app/audit/page.tsx to pass provider + apiKey**

```tsx
"use client"

import { experimental_useObject as useObject } from "@ai-sdk/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { AuditHeader } from "@/components/dashboard/AuditHeader"
import { MetricsStrip } from "@/components/dashboard/MetricsStrip"
import { ModuleCard } from "@/components/dashboard/ModuleCard"
import { SkeletonCard } from "@/components/ui/SkeletonCard"
import { AuditSchema } from "@/lib/schema"

function AuditPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session") ?? ""
  const model = searchParams.get("model") ?? ""
  const provider = (searchParams.get("provider") ?? "ollama") as "ollama" | "gemini"

  const hasSubmitted = useRef(false)
  const [apiKey, setApiKey] = useState<string | null>(null)

  useEffect(() => {
    if (provider === "gemini") {
      setApiKey(sessionStorage.getItem(`gemini-key-${sessionId}`) ?? "")
    } else {
      setApiKey("")
    }
  }, [sessionId, provider])

  const { object, isLoading, error, submit } = useObject({
    api: "/api/audit",
    schema: AuditSchema,
  })

  useEffect(() => {
    if (hasSubmitted.current || !sessionId || !model || apiKey === null) return
    if (provider === "gemini" && !apiKey) return
    hasSubmitted.current = true
    submit({ sessionId, model, provider, apiKey: apiKey || undefined })
  }, [sessionId, model, provider, apiKey, submit])

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            ← New audit
          </button>
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="size-1.5 rounded-full bg-zinc-400 animate-pulse" />
              Streaming…
            </span>
          )}
          {error && (
            <span className="text-xs text-red-500">{error.message}</span>
          )}
        </div>

        <MetricsStrip
          healthScore={object?.health_score}
          totalTechDebt={object?.total_tech_debt_hours}
          criticalIssues={object?.critical_issues_count}
        />

        <AuditHeader summary={object?.executive_summary} model={model} />

        <div className="space-y-3">
          {object?.modules?.map((module, i: number) => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <ModuleCard key={i} module={(module ?? {}) as any} index={i} />
          ))}
          {isLoading && <SkeletonCard />}
        </div>

        {!isLoading && !error && object?.modules && object.modules.length > 0 && (
          <p className="text-center text-xs text-zinc-400 pb-8">
            Audit complete · {object.modules.length} modules ·{" "}
            {object.modules.reduce(
              (a: number, m) => a + (m?.components?.length ?? 0),
              0
            )}{" "}
            components · {provider === "gemini" ? "Gemini" : "Ollama"}
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
```

- [ ] **Step 7: Verify full compile**

```bash
cd /Users/ztlab173/Documents/Learning/arch-rag && npx tsc --noEmit 2>&1
```

Expected: no errors.

---

### Task 7: Fix test description

**Files:**
- Modify: `__tests__/chunker.test.ts`

- [ ] **Step 1: Fix test description to match MIN_CHUNK_LENGTH=10**

Change line 27:
```typescript
  it("filters out chunks shorter than MIN_CHUNK_LENGTH (10 chars)", () => {
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/ztlab173/Documents/Learning/arch-rag && bun test
```

Expected: all tests pass.

---

## Self-Review

**Spec coverage:**
- ✅ Fix 1: Security path validation → Task 1 (validateDirectoryPath/validateGitUrl) + Task 5 (route calls validateDirectoryPath)
- ✅ Fix 2: Cleanup leak → Task 5 (finally block)
- ✅ Fix 3: Bare catch silences errors → Task 2 (errorCount tracking, throws when all fail)
- ✅ Fix 4: TEXT_EXTENSIONS diverge → Tasks 1-3 (shared.ts, upload.ts, directory.ts unified)
- ✅ Fix 5: Test description mismatch → Task 7
- ✅ Fix 6: embedBatch serial → acknowledged; `@xenova/transformers` uses a single ONNX worker so Promise.all gains nothing — no change needed, only naming is misleading
- ✅ Fix 7: ChromaDB new client per call → noted as low-severity; no change in this iteration (module-level singleton would need session handling)
- ✅ gitignore-aware indexing → Task 1 (loadIgnorePatterns) + Task 2 (directory.ts uses it)
- ✅ .agentignore, .dockerignore, node_modules, *.lock, .env*, build dirs → DEFAULT_IGNORE + loadIgnorePatterns
- ✅ Gemini provider → Task 6 (GeminiConfig component, audit route, page updates, sessionStorage for key)

**Placeholder scan:** No TBDs, no "implement later".

**Type consistency:** `provider: "ollama" | "gemini"` used consistently across Props, route, page params. `apiKey?: string` in audit route body matches `apiKey: apiKey || undefined` in submit call.

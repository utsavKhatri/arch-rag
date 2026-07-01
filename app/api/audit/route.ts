import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { Output, streamText } from "ai"
import type { NextRequest } from "next/server"
import { queryRelevantChunks } from "@/lib/chromadb"
import { embedBatch } from "@/lib/embedder"
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

  const resolvedApiKey = apiKey || process.env.GEMINI_API_KEY

  if (provider === "gemini" && !resolvedApiKey) {
    return Response.json(
      { error: "Gemini API key required — enter it in the UI or set GEMINI_API_KEY in .env" },
      { status: 400 }
    )
  }

  // Several concern-targeted queries beat one generic embedding: each surfaces a
  // different slice of the codebase, and queryRelevantChunks merges + dedupes them.
  const RETRIEVAL_QUERIES = [
    "security vulnerabilities authentication authorization input validation injection secrets",
    "module structure architecture responsibilities services controllers data flow",
    "code complexity coupling tech debt duplication large functions error handling",
  ]
  const queryEmbeddings = await embedBatch(RETRIEVAL_QUERIES)

  const chunks = await queryRelevantChunks(sessionId, queryEmbeddings, 15, 40)

  if (chunks.length === 0) {
    return Response.json(
      { error: "No indexed content found for this session. Re-index your codebase first." },
      { status: 422 }
    )
  }

  const aiModel =
    provider === "gemini"
      ? createGoogleGenerativeAI({ apiKey: resolvedApiKey })(model)
      : createOpenAI({ baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1", apiKey: "ollama" })(model)

  const result = streamText({
    model: aiModel,
    output: Output.object({ schema: AuditSchema }),
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(chunks),
    temperature: 0,
    // Bound the call so a stuck/unauthorized upstream fails fast instead of
    // hanging the request open forever.
    abortSignal: AbortSignal.timeout(120_000),
    // Surface the real provider error in the server log — without this an auth
    // failure (e.g. an invalid API key) is swallowed and the request just pends.
    onError: ({ error }) => {
      console.error("[/api/audit] stream error:", error)
    },
  })

  return result.toTextStreamResponse()
}

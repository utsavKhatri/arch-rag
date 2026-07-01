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
          // validateGitUrl called inside extractFromGit
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
          35 +
          Math.round(
            (Math.min(i + EMBED_BATCH, chunks.length) / chunks.length) * 45
          )
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

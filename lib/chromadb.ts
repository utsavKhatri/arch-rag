import { ChromaClient, type Collection } from "chromadb"
import type { Chunk } from "./chunker"

function getClient(): ChromaClient {
  const host = process.env.CHROMADB_HOST ?? "localhost"
  const port = Number(process.env.CHROMADB_PORT ?? 8000)
  return new ChromaClient({ host, port, ssl: false })
}

export async function createCollection(sessionId: string): Promise<Collection> {
  const client = getClient()
  return client.getOrCreateCollection({
    name: `session-${sessionId}`,
    configuration: { hnsw: { space: "cosine" } },
    // We embed locally (xenova) and pass vectors explicitly — Chroma must never
    // try to embed. null disables the DefaultEmbeddingFunction (which would
    // otherwise require the @chroma-core/default-embed package).
    embeddingFunction: null,
  })
}

export async function storeChunks(
  sessionId: string,
  chunks: Chunk[],
  embeddings: number[][]
): Promise<void> {
  const collection = await createCollection(sessionId)

  const BATCH_SIZE = 100
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + BATCH_SIZE)
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE)

    await collection.add({
      ids: batchChunks.map((_, j) => `chunk-${i + j}`),
      embeddings: batchEmbeddings,
      documents: batchChunks.map((c) => c.content),
      metadatas: batchChunks.map((c) => c.metadata),
    })
  }
}

// Per-file cap keeps one large file from crowding out the rest of the codebase.
// Applied as a soft first pass — a second pass backfills if it left slots empty,
// so a tiny single-file codebase still returns everything it has.
const PER_FILE_CAP = 6

interface RankedChunk {
  content: string
  file: string
  distance: number
}

// Raw per-query arrays as returned by ChromaDB's multi-embedding query.
interface MultiQueryResult {
  ids: string[][]
  documents: (string | null)[][]
  metadatas: (Record<string, unknown> | null)[][]
  distances?: (number | null)[][] | null
}

/**
 * Pure merge/rank step (no DB): dedupe chunks across queries by id keeping the
 * best cosine distance, then return up to maxTotal ranked by relevance with a
 * per-file diversity cap. Exported for unit testing.
 */
export function mergeAndRankChunks(
  results: MultiQueryResult,
  queryCount: number,
  maxTotal = 40
): { content: string; metadata: { file: string } }[] {
  const seen = new Map<string, RankedChunk>()
  for (let q = 0; q < queryCount; q++) {
    const ids = results.ids[q] ?? []
    const docs = results.documents[q] ?? []
    const metas = results.metadatas[q] ?? []
    const dists = results.distances?.[q] ?? []
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const distance = dists[i] ?? 1
      const existing = seen.get(id)
      if (!existing || distance < existing.distance) {
        seen.set(id, {
          content: docs[i] ?? "",
          file: (metas[i]?.file as string) ?? "unknown",
          distance,
        })
      }
    }
  }

  const ranked = [...seen.values()].sort((a, b) => a.distance - b.distance)

  // Pass 1: relevance order, capped per file for diversity.
  const out: RankedChunk[] = []
  const perFile = new Map<string, number>()
  for (const chunk of ranked) {
    if (out.length >= maxTotal) break
    const n = perFile.get(chunk.file) ?? 0
    if (n >= PER_FILE_CAP) continue
    perFile.set(chunk.file, n + 1)
    out.push(chunk)
  }
  // Pass 2: backfill remaining slots ignoring the cap (small codebases, few files).
  if (out.length < maxTotal) {
    const picked = new Set(out)
    for (const chunk of ranked) {
      if (out.length >= maxTotal) break
      if (!picked.has(chunk)) out.push(chunk)
    }
  }

  return out.map((c) => ({ content: c.content, metadata: { file: c.file } }))
}

/**
 * Retrieve chunks across several concern-targeted query embeddings (security,
 * architecture, complexity, …), merge them by chunk id keeping the best match,
 * and rank by relevance with a per-file diversity cap.
 */
export async function queryRelevantChunks(
  sessionId: string,
  queryEmbeddings: number[][],
  nPerQuery = 15,
  maxTotal = 40
): Promise<{ content: string; metadata: { file: string } }[]> {
  // getOrCreate (via createCollection) so we inherit embeddingFunction: null.
  // A missing session resolves to an empty collection → count 0 → []; the audit
  // route turns that into a 422 rather than a 500.
  const collection = await createCollection(sessionId)

  const count = await collection.count()
  if (count === 0) return []

  const results = await collection.query({
    queryEmbeddings,
    nResults: Math.min(nPerQuery, count),
  })

  return mergeAndRankChunks(results as MultiQueryResult, queryEmbeddings.length, maxTotal)
}

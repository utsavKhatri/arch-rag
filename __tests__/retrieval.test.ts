import { describe, expect, it } from "vitest"
import { mergeAndRankChunks } from "@/lib/chromadb"

// Helper: build a ChromaDB-shaped multi-query result from compact rows.
function result(
  queries: { id: string; file: string; distance: number; content?: string }[][]
) {
  return {
    ids: queries.map((q) => q.map((r) => r.id)),
    documents: queries.map((q) => q.map((r) => r.content ?? r.id)),
    metadatas: queries.map((q) => q.map((r) => ({ file: r.file }))),
    distances: queries.map((q) => q.map((r) => r.distance)),
  }
}

describe("mergeAndRankChunks", () => {
  it("dedupes by id, keeping the lowest distance, and ranks by relevance", () => {
    const r = result([
      [{ id: "c1", file: "a.ts", distance: 0.9 }],
      [{ id: "c1", file: "a.ts", distance: 0.2 }, { id: "c2", file: "b.ts", distance: 0.5 }],
    ])
    const out = mergeAndRankChunks(r, 2)
    expect(out.map((c) => c.metadata.file)).toEqual(["a.ts", "b.ts"]) // c1 (0.2) before c2 (0.5)
    expect(out).toHaveLength(2) // c1 appeared twice but counted once
  })

  it("caps one file's share when slots are scarce, so others get represented", () => {
    // huge.ts has the 10 most-relevant chunks; 20 other files compete.
    // With maxTotal=10, the cap stops huge.ts from taking every slot.
    const big = Array.from({ length: 10 }, (_, i) => ({
      id: `big${i}`,
      file: "huge.ts",
      distance: i * 0.01,
    }))
    const others = Array.from({ length: 20 }, (_, i) => ({
      id: `o${i}`,
      file: `file${i}.ts`,
      distance: 0.5 + i * 0.01,
    }))
    const out = mergeAndRankChunks(result([[...big, ...others]]), 1, 10)
    const fromHuge = out.filter((c) => c.metadata.file === "huge.ts").length
    expect(out).toHaveLength(10)
    expect(fromHuge).toBe(6) // PER_FILE_CAP — remaining 4 slots go to other files
  })

  it("backfills past the per-file cap when too few files exist (small codebase)", () => {
    // Single file with 9 chunks, maxTotal 40 — must return all 9, not just the cap of 6.
    const chunks = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i}`,
      file: "only.md",
      distance: i * 0.01,
    }))
    const out = mergeAndRankChunks(result([chunks]), 1, 40)
    expect(out).toHaveLength(9)
  })

  it("respects maxTotal", () => {
    const chunks = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      file: `f${i}.ts`,
      distance: i * 0.01,
    }))
    const out = mergeAndRankChunks(result([chunks]), 1, 40)
    expect(out).toHaveLength(40)
  })
})

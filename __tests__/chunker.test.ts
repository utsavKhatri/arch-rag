import { describe, expect, it } from "vitest"
import { chunkDocument, chunkDocuments } from "@/lib/chunker"

describe("chunkDocument", () => {
  it("returns a single chunk for short content", () => {
    const chunks = chunkDocument("hello world", {
      file: "a.ts",
      source_type: "upload",
    })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe("hello world")
    expect(chunks[0].metadata.file).toBe("a.ts")
  })

  it("splits long content into overlapping chunks", () => {
    const content = "a".repeat(5000)
    const chunks = chunkDocument(content, {
      file: "big.ts",
      source_type: "directory",
    })
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((c) => {
      expect(c.content.length).toBeLessThanOrEqual(2100)
    })
  })

  it("filters out chunks shorter than MIN_CHUNK_LENGTH (10 chars)", () => {
    const chunks = chunkDocument("tiny", {
      file: "a.ts",
      source_type: "upload",
    })
    expect(chunks).toHaveLength(0)
  })

  it("preserves metadata on every chunk", () => {
    const content = "x".repeat(3000)
    const chunks = chunkDocument(content, {
      file: "src/index.ts",
      source_type: "git",
    })
    chunks.forEach((c) => {
      expect(c.metadata.file).toBe("src/index.ts")
      expect(c.metadata.source_type).toBe("git")
      expect(typeof c.metadata.start_char).toBe("number")
      expect(typeof c.metadata.end_char).toBe("number")
    })
  })
})

describe("chunkDocuments", () => {
  it("flattens chunks from multiple documents", () => {
    const docs = [
      { content: "hello world content", metadata: { file: "a.ts", source_type: "upload" } },
      { content: "b".repeat(3000), metadata: { file: "b.ts", source_type: "upload" } },
    ]
    const chunks = chunkDocuments(docs)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })
})

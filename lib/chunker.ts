const CHUNK_SIZE = 2000
const OVERLAP = 200
const MIN_CHUNK_LENGTH = 10

export interface Chunk {
  content: string
  metadata: {
    file: string
    start_char: number
    end_char: number
    source_type: string
  }
}

export function chunkDocument(
  content: string,
  metadata: { file: string; source_type: string }
): Chunk[] {
  const chunks: Chunk[] = []
  let start = 0

  while (start < content.length) {
    const end = Math.min(start + CHUNK_SIZE, content.length)

    let breakPoint = end
    if (end < content.length) {
      const newlineIdx = content.lastIndexOf("\n", end)
      if (newlineIdx > start + CHUNK_SIZE / 2) {
        breakPoint = newlineIdx + 1
      }
    }

    const text = content.slice(start, breakPoint).trim()
    if (text.length >= MIN_CHUNK_LENGTH) {
      chunks.push({
        content: text,
        metadata: { ...metadata, start_char: start, end_char: breakPoint },
      })
    }

    const next = breakPoint - OVERLAP
    if (next <= start) break
    start = next
  }

  return chunks
}

export function chunkDocuments(
  docs: { content: string; metadata: { file: string; source_type: string } }[]
): Chunk[] {
  return docs.flatMap((doc) => chunkDocument(doc.content, doc.metadata))
}

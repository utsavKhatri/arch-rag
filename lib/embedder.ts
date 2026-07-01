// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeatureExtractionPipeline = any

let _extractor: FeatureExtractionPipeline | null = null

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!_extractor) {
    // ponytail: dynamic import defers native module loading to runtime — avoids
    // Next.js build-time execution pulling in @xenova/transformers and its sharp dep.
    const { env, pipeline } = await import("@xenova/transformers")
    env.cacheDir = "./.cache/transformers"
    env.allowRemoteModels = true
    _extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    )
  }
  return _extractor
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor()
  const output = await extractor(text, { pooling: "mean", normalize: true })
  return Array.from(output.data as Float32Array)
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []
  for (const text of texts) {
    embeddings.push(await embed(text))
  }
  return embeddings
}

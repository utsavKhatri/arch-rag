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

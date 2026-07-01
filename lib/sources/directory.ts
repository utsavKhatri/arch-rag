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

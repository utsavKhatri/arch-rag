import { readFile } from "fs/promises"
import path from "path"
import { TEXT_EXTENSIONS, isTextFile } from "../extensions"

export { TEXT_EXTENSIONS, isTextFile }

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
      const raw = await readFile(path.join(/* turbopackIgnore: true */ dirPath, filename), "utf-8")
      for (const line of raw.split("\n")) {
        const p = line.trim()
        if (!p || p.startsWith("#") || p.startsWith("!")) continue
        const normalized = p.startsWith("/") ? p.slice(1) : p
        const globbed = normalized.endsWith("/") ? `${normalized}**` : normalized
        patterns.push(globbed)
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

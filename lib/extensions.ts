export const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "go", "rs", "java", "cpp", "c", "h",
  "md", "txt", "json", "yaml", "yml", "toml",
  "css", "scss", "html", "sql", "sh",
])

export const ACCEPT_ATTR = [...TEXT_EXTENSIONS].map((e) => `.${e}`).join(",")

export function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return TEXT_EXTENSIONS.has(ext)
}

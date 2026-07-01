import { isTextFile } from "./shared"

export interface SourceDocument {
  content: string
  metadata: { file: string; source_type: string }
}

export async function extractFromFormData(
  formData: FormData
): Promise<SourceDocument[]> {
  const docs: SourceDocument[] = []
  const files = formData.getAll("files") as File[]
  for (const file of files) {
    if (!isTextFile(file.name)) continue
    const content = await file.text()
    if (content.trim().length === 0) continue
    docs.push({
      content,
      metadata: { file: file.name, source_type: "upload" },
    })
  }
  return docs
}

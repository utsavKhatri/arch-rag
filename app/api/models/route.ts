export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface OllamaModel {
  name: string
  size: number
  details?: { parameter_size?: string }
}

interface OllamaTagsResponse {
  models: OllamaModel[]
}

export async function GET() {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) {
      return Response.json({ models: [], error: "Ollama returned an error" })
    }

    const data = (await res.json()) as OllamaTagsResponse

    const models = data.models.map((m) => ({
      name: m.name,
      parameterSize: m.details?.parameter_size ?? null,
    }))

    return Response.json({ models })
  } catch {
    return Response.json({
      models: [],
      error:
        "Ollama is not running. Start it with: ollama serve",
    })
  }
}

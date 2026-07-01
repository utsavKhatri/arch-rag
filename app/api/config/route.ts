export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Reports whether the server has a Gemini key in .env — never the key itself —
// so the UI can make the API-key input optional when one is already configured.
export async function GET() {
  return Response.json({ geminiKeyConfigured: !!process.env.GEMINI_API_KEY })
}

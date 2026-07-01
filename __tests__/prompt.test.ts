import { describe, expect, it } from "vitest"
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt"

describe("buildSystemPrompt", () => {
  // The schema shape is enforced by the SDK (Output.object), not the prompt.
  // The prompt's job is the judgment the schema can't carry — so we assert that.
  it("grounds the model in the retrieved sample, not the whole repo", () => {
    const prompt = buildSystemPrompt().toLowerCase()
    expect(prompt).toContain("sample")
    expect(prompt).toMatch(/never invent|do not invent|cannot point to/)
  })

  it("explains the scoring scales", () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain("complexity_score")
    expect(prompt).toContain("health_score")
    expect(prompt).toContain("tech_debt_estimate_hours")
  })

  it("forbids padding findings with placeholders", () => {
    const prompt = buildSystemPrompt().toLowerCase()
    expect(prompt).toContain("empty list")
    expect(prompt).toContain("none identified")
  })
})

describe("buildUserPrompt", () => {
  it("includes all chunk contents", () => {
    const chunks = [
      { content: "function foo() {}", metadata: { file: "a.ts" } },
      { content: "class Bar {}", metadata: { file: "b.ts" } },
    ]
    const prompt = buildUserPrompt(chunks)
    expect(prompt).toContain("function foo() {}")
    expect(prompt).toContain("class Bar {}")
  })

  it("includes file paths as labels", () => {
    const chunks = [
      { content: "export default function App() {}", metadata: { file: "app/page.tsx" } },
    ]
    const prompt = buildUserPrompt(chunks)
    expect(prompt).toContain("app/page.tsx")
  })

  it("returns empty context gracefully", () => {
    const prompt = buildUserPrompt([])
    expect(typeof prompt).toBe("string")
    expect(prompt.length).toBeGreaterThan(0)
  })
})

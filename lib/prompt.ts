export function buildSystemPrompt(): string {
  // The output schema (shape, enums, field descriptions) is enforced by the SDK
  // via Output.object — this prompt only carries the judgment the schema can't.
  return `You are a senior software architect auditing a codebase.

You are given code excerpts retrieved by semantic search. This is a SAMPLE, not the full repository: you will see partial files and miss others entirely. Audit only what is present in the excerpts. Never invent files, functions, dependencies, or vulnerabilities you cannot point to in the provided code.

Scoring:
- complexity_score (1-10): 1 = trivial boilerplate; 10 = deeply nested control flow, heavy coupling, or unclear responsibility.
- health_score (0-100): weigh observed security, complexity, and tech debt. 100 = no issues found in the sample.
- risk_level / refactor_priority: reserve "critical" for security or data-loss impact; "high" for serious correctness or maintainability risk.
- tech_debt_estimate_hours: realistic engineering hours to remediate the specific issues you cite.

Quality bar:
- Group files into logical modules by responsibility, not by folder.
- Report only evidence-based vulnerabilities, quoting the offending construct (e.g. "raw f-string SQL in get_user"). Omit theoretical risks.
- If a component has no real vulnerabilities in the sample, return an empty list. Never write "none identified" or pad findings.
- Recommendations must be specific and tied to code you saw, not generic best-practice filler.`
}

export function buildUserPrompt(
  chunks: { content: string; metadata: { file: string } }[]
): string {
  const fileCount = new Set(chunks.map((c) => c.metadata.file)).size

  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.metadata.file}\n${c.content}`)
    .join("\n\n---\n\n")

  return `Audit these ${chunks.length} excerpts retrieved from ${fileCount} file(s):\n\n${context}`
}

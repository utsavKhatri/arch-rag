import { z } from "zod"

export const ComponentSchema = z.object({
  name: z.string().describe("Component or class name"),
  file_path: z.string().describe("Relative file path"),
  complexity_score: z
    .number()
    .min(1)
    .max(10)
    .describe("Cyclomatic complexity 1-10"),
  security_vulnerabilities: z
    .array(z.string())
    .describe("List of specific security issues found"),
  refactor_priority: z
    .enum(["low", "medium", "high", "critical"])
    .describe("Refactoring urgency"),
  dependency_graph: z
    .array(z.string())
    .describe("Names of direct dependencies"),
  tech_debt_estimate_hours: z
    .number()
    .describe("Estimated hours to resolve tech debt"),
  patterns_detected: z
    .array(z.string())
    .describe("Anti-patterns or design patterns identified"),
  recommendations: z
    .array(z.string())
    .describe("Concrete actionable improvement steps"),
})

export const ModuleSchema = z.object({
  name: z.string().describe("Logical module name"),
  description: z
    .string()
    .describe("What this module is responsible for"),
  risk_level: z
    .enum(["low", "medium", "high", "critical"])
    .describe("Overall module risk"),
  components: z.array(ComponentSchema),
})

export const AuditSchema = z.object({
  executive_summary: z
    .string()
    .describe("2-3 sentence overview of codebase health"),
  health_score: z
    .number()
    .min(0)
    .max(100)
    .describe("Overall health score 0-100"),
  total_tech_debt_hours: z
    .number()
    .describe("Sum of all tech debt estimates in hours"),
  critical_issues_count: z
    .number()
    .describe("Number of critical-priority issues"),
  modules: z.array(ModuleSchema),
})

export type Component = z.infer<typeof ComponentSchema>
export type Module = z.infer<typeof ModuleSchema>
export type Audit = z.infer<typeof AuditSchema>
export type RefactorPriority = Component["refactor_priority"]
export type RiskLevel = Module["risk_level"]

# Arch-RAG Intelligence Engine — Design Spec
**Date:** 2026-06-01  
**Status:** Approved  
**Stack:** Next.js 16 App Router · React 19 · Tailwind 4 · Vercel AI SDK · Ollama · ChromaDB · TypeScript

---

## 1. Problem Statement

Build a high-performance, privacy-centric RAG (Retrieval-Augmented Generation) Intelligence Engine that indexes local technical documentation or codebases and generates context-aware architectural audits. 100% local inference, zero third-party API calls, zero cost. Targeted at security-conscious enterprise environments where data must never leave the machine.

---

## 2. Architecture Overview

### System Boundary
Three locally-running processes:
- **Next.js 16 dev server** (port 3000)
- **ChromaDB** (port 8000) — vector store
- **Ollama** (port 11434) — LLM inference

No external API calls. No telemetry. No cloud.

### Approach
Pure Next.js monolith — one codebase, one `npm run dev`. Ollama accessed via its OpenAI-compatible endpoint (`/v1`) using `@ai-sdk/openai` with a custom `baseURL`. Embeddings via `@xenova/transformers` running in the Node.js process (no Ollama dependency for embeddings). ChromaDB accessed via the `chromadb` JS client.

### Next.js File Structure
```
app/
├── page.tsx                     # Step 1: Source config wizard
├── audit/
│   └── page.tsx                 # Step 2: Streaming audit dashboard
├── api/
│   ├── index/route.ts           # Ingest → chunk → embed → store in ChromaDB
│   ├── audit/route.ts           # Query ChromaDB → streamObject via Ollama
│   └── models/route.ts          # Proxy to `ollama list` → available models
└── layout.tsx

lib/
├── schema.ts                    # Zod AuditSchema (single source of truth)
├── chunker.ts                   # 512-token chunking with 50-token overlap
├── embedder.ts                  # @xenova/transformers wrapper (all-MiniLM-L6-v2)
├── chromadb.ts                  # ChromaDB client + collection helpers
├── prompt.ts                    # Schema-to-prompt builder
└── sources/
    ├── upload.ts                # Multipart file upload handler
    ├── directory.ts             # Local directory reader (glob + fs)
    └── git.ts                   # Git clone to temp dir via simple-git

components/
├── wizard/
│   ├── SourceSelector.tsx       # Three-tab source type switcher
│   ├── FileDropzone.tsx         # Drag & drop upload zone
│   ├── DirectoryInput.tsx       # Local path input with validation
│   ├── GitInput.tsx             # Git URL input with validation
│   ├── ModelSelector.tsx        # Dropdown populated from /api/models
│   └── RunButton.tsx            # CTA with indexing progress + loading state
└── dashboard/
    ├── AuditHeader.tsx          # Health score badge + executive summary
    ├── MetricsStrip.tsx         # Health score, tech debt, critical issues (count-up)
    ├── ModuleCard.tsx           # Streaming module card with component list
    ├── ComponentRow.tsx         # Per-component detail row
    ├── ComplexityBar.tsx        # Animated width bar (1–10 scale)
    ├── RiskBadge.tsx            # Color-coded risk/priority badge
    ├── VulnerabilityChip.tsx    # Security issue inline chip
    └── SkeletonCard.tsx         # Pulse placeholder between stream arrivals
```

---

## 3. Data Flow

### 3a. Indexing Pipeline (`POST /api/index`)

```
Source input
    │
    ├─ File upload    → Request.formData() → buffers
    ├─ Directory path → glob('**/*.{ts,tsx,js,py,go,md,txt}') → fs.readFile
    └─ Git URL        → simple-git.clone() to OS temp dir → directory read → cleanup
    │
    ▼
Chunking (lib/chunker.ts)
    └─ 512-token chunks, 50-token overlap
       Metadata per chunk: { file, start_line, end_line, source_type }
    │
    ▼
Embedding (lib/embedder.ts)
    └─ @xenova/transformers · all-MiniLM-L6-v2 · 384-dim vectors
       Runs in Node.js worker thread (non-blocking)
    │
    ▼
ChromaDB store (lib/chromadb.ts)
    └─ Collection name: session ID (UUID)
       Documents: { id, embedding, document, metadata }
    │
    ▼
SSE progress events → client progress bar → redirect to /audit?session={id}
```

### 3b. Audit Pipeline (`POST /api/audit`)

```
Session ID from query param
    │
    ▼
ChromaDB query (lib/chromadb.ts)
    └─ Query string: "modules components security complexity architecture"
       Top 30 chunks retrieved with metadata
    │
    ▼
Prompt construction (lib/prompt.ts)
    └─ System prompt: role + schema shape as JSON template + output contract
       User prompt: retrieved chunks as numbered context blocks
    │
    ▼
streamObject (Vercel AI SDK)
    └─ Provider: @ai-sdk/openai({ baseURL: 'http://localhost:11434/v1' })
       Model: user-selected Ollama model
       Schema: AuditSchema (Zod)
       Output: streamed partial JSON
    │
    ▼
SSE → useObject hook (ai/react) → card-by-card render
```

---

## 4. Zod Schema Contract

`lib/schema.ts` is the single source of truth. The prompt builder, `streamObject`, and dashboard rendering all derive from it.

```typescript
const ComponentSchema = z.object({
  name: z.string(),
  file_path: z.string(),
  complexity_score: z.number().min(1).max(10),
  security_vulnerabilities: z.array(z.string()),
  refactor_priority: z.enum(["low", "medium", "high", "critical"]),
  dependency_graph: z.array(z.string()),
  tech_debt_estimate_hours: z.number(),
  patterns_detected: z.array(z.string()),
  recommendations: z.array(z.string()),
})

const ModuleSchema = z.object({
  name: z.string(),
  description: z.string(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  components: z.array(ComponentSchema),
})

export const AuditSchema = z.object({
  executive_summary: z.string(),
  health_score: z.number().min(0).max(100),
  total_tech_debt_hours: z.number(),
  critical_issues_count: z.number(),
  modules: z.array(ModuleSchema),
})

export type Audit = z.infer<typeof AuditSchema>
```

**Schema-to-prompt engineering:** `lib/prompt.ts` serializes the Zod schema into a JSON template string injected into the system prompt. This constrains the LLM output and makes `streamObject` deterministic. The system prompt includes: role definition, schema template, field-by-field instructions, and a strict "output only valid JSON" contract.

**Streaming order:** Fields stream in schema-declaration order. `executive_summary` and `health_score` arrive first → metrics strip animates in immediately. `modules` array streams item-by-item → cards appear progressively.

---

## 5. UI/UX Design

### Visual Direction
Clean minimal light. White/zinc-50 backgrounds. Zinc-900 primary text, zinc-500 secondary. Zinc-200 borders. Geist Sans for UI text (already installed), Geist Mono for file paths and code values. Zero decorative elements — every visual component carries information.

**Risk color system (semantic, not decorative):**
| Level | Text | Background |
|-------|------|-----------|
| low | emerald-700 | emerald-50 |
| medium | amber-700 | amber-50 |
| high | orange-700 | orange-50 |
| critical | red-700 | red-50 |

### Step 1 — Source Config Wizard (`/`)

**Layout:** Centered single-column, max-w-xl, vertically centered on viewport. Clean header with product name and tagline.

**Source selector:** Three tabs (Upload Files / Local Directory / Git URL) with a sliding underline indicator (`transition-transform` on a `div`). One input panel per tab — only the active tab's panel is mounted.

- **Upload tab:** Dashed-border drop zone. On drag-over: border transitions to zinc-400, subtle `scale-[1.01]` transform. On drop: file list appears with names and sizes. Supports multiple files and folders.
- **Directory tab:** Single path input with monospace font. Real-time validation (path format check client-side, existence check deferred to indexing).
- **Git tab:** URL input. Validates `https://` or `git@` prefix client-side. Shows detected platform icon (GitHub / GitLab / Bitbucket) based on URL.

**Model selector:** Dropdown populated from `GET /api/models`. Shows skeleton while loading. Displays model name + parameter count. Default pre-selected: Gemma 4 2B if available, else Llama 3.1 8B, else first available.

**Run Audit button:** Full-width, zinc-900 bg, white text. Disabled (opacity-40, cursor-not-allowed) until source is valid. On click: transitions to an indexing progress state in-place — button label replaced by progress bar + status text ("Chunking files… Embedding… Storing…") streamed from `/api/index` SSE. On completion: smooth page navigation to `/audit?session={id}`.

### Step 2 — Streaming Audit Dashboard (`/audit`)

**Layout:** Full-width, max-w-5xl centered. Two regions: sticky top metrics strip + scrollable card grid below.

**Metrics strip (streams in first):**
Three stat blocks side-by-side: Health Score (0–100 with count-up animation), Total Tech Debt (hours, count-up), Critical Issues (count-up). Each block has a label and large number. The health score number is color-coded by value (green > 70, amber 40–70, red < 40).

**Executive summary:** Full-width text block below metrics, fades in character-by-character as the string streams. Subtle zinc-100 background, left border accent in zinc-300.

**Module cards grid:** Single column, full width. Cards appear one-by-one as modules stream in from the LLM. Each card:
- Header: module name (semibold), description (zinc-500), risk badge (top-right)
- Body: list of component rows
- Each component row: file path (monospace, zinc-500), complexity bar (animated width), refactor priority badge, expandable section for vulnerabilities + recommendations

**Skeleton cards:** A pulsing skeleton card appears while waiting for the next module to arrive. Removed and replaced by the real card when data lands.

**Micro-interactions (CSS + Tailwind only):**
- Card entrance: `opacity-0 translate-y-3` → `opacity-100 translate-y-0`, `transition-all duration-300`
- Staggered card delay: each card gets `style={{ transitionDelay: `${index * 80}ms` }}`
- Complexity bar: `width: 0` → `width: {score * 10}%`, `transition-[width] duration-700 delay-300`
- Count-up numbers: CSS `@keyframes` with `counter-increment` or JS `requestAnimationFrame` loop (simple 60fps interpolation over 800ms)
- Skeleton: `animate-pulse` Tailwind class
- Vulnerability chips: entrance `scale-95 opacity-0` → `scale-100 opacity-100` with 50ms stagger per chip

---

## 6. API Design

### `GET /api/models`
Calls `http://localhost:11434/api/tags`, returns `{ models: { name: string, size: string }[] }`. Returns `{ models: [], error: "Ollama not running" }` on connection failure — shown as a warning in the wizard (not a blocker).

### `POST /api/index`
Accepts: `multipart/form-data` (files) OR `application/json` `{ type: "directory" | "git", path: string }`.  
Streams SSE events: `{ type: "progress", message: string, percent: number }`.  
Final event: `{ type: "done", sessionId: string }`.  
On error: `{ type: "error", message: string }`.

### `POST /api/audit`
Accepts: `application/json` `{ sessionId: string, model: string }`.  
Returns: `streamObject` SSE stream (Vercel AI SDK format), consumed by `useObject`.

---

## 7. Dependencies to Install

```bash
bun add ai @ai-sdk/openai chromadb zod simple-git glob
bun add @xenova/transformers
bun add -d @types/node
```

**Versions pinned to latest stable at time of spec:**
- `ai`: ^4.x (Vercel AI SDK v4)
- `@ai-sdk/openai`: ^1.x
- `chromadb`: ^1.x
- `@xenova/transformers`: ^2.x
- `simple-git`: ^3.x
- `glob`: ^11.x

---

## 8. Error Handling

| Scenario | Handling |
|----------|----------|
| ChromaDB not running | `/api/index` returns `{ type: "error", message: "ChromaDB not reachable at localhost:8000. Run: docker run -p 8000:8000 chromadb/chroma" }` — shown as inline error in wizard |
| Ollama not running | `GET /api/models` returns empty models list with warning — wizard shows setup banner, audit CTA disabled |
| Model doesn't support structured output | Prompt includes explicit JSON-only instruction + retry with temperature: 0 |
| Empty codebase / no chunks | `/api/index` returns error before writing to ChromaDB |
| Large codebase (>10k chunks) | Chunking runs in batches of 100, progress streamed per batch |
| Git clone failure | `simple-git` error caught, temp dir cleaned up, error event streamed to client |

---

## 9. Setup Requirements (README)

Users need three things running locally before `npm run dev`:
1. **Ollama** — `brew install ollama && ollama pull gemma4:2b`
2. **ChromaDB** — `docker run -p 8000:8000 chromadb/chroma`
3. **Node.js 20+** — `bun install && bun run dev`

---

## 10. Out of Scope

- Authentication / multi-user
- Persistent audit history (sessions are ephemeral — ChromaDB collection deleted after session)
- Diff-based re-indexing (full re-index on each run)
- PDF / binary file parsing (text and code files only)
- Deployment to cloud (local-only by design)

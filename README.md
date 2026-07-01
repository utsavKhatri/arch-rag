# Arch-RAG

Privacy-first architectural code auditor. Point it at a codebase and get a structured JSON audit — modules, components, complexity scores, security vulnerabilities, tech-debt estimates, and actionable recommendations — streamed live in your browser.

All embedding is 100% local (`all-MiniLM-L6-v2` via `@xenova/transformers`). Inference runs either through **Ollama** (fully local, zero data leaves your machine) or **Gemini** (Google cloud, opt-in).

---

## Demo

<video src="public/demo.mov" controls width="100%"></video>

> If the inline player doesn't load (Chrome doesn't play `.mov`), [download the demo](public/demo.mov) or open it in Safari / QuickTime.

---

## How it works

```
Codebase source          Index pipeline             Audit pipeline
─────────────────        ──────────────────         ──────────────────────────
Upload files     ──┐     Chunk (2 000-char          Multi-query retrieval:
Local directory  ──┘──▶  overlapping windows)  ──▶   3 concern-targeted queries
                         Embed (MiniLM, local)  ──▶  (security / architecture /
                         Store in ChromaDB           complexity), deduped with a
                                                     per-file diversity cap
                                                        │
                                                        ▼
                                                     Stream structured JSON
                                                     via Ollama or Gemini
```

The audit result is validated against a Zod schema and streamed field-by-field using the Vercel AI SDK's `streamText` with `Output.object`. You see modules appear live as the model writes them. Completed audits are cached in `sessionStorage` (keyed by session + model + provider) so revisiting the results page is instant and costs no extra LLM call.

---

## Prerequisites

| Service | Default address | Required for |
|---|---|---|
| [ChromaDB](https://docs.trychroma.com/getting-started) | `localhost:8000` | All runs (vector store) |
| [Ollama](https://ollama.com) | `localhost:11434` | Local inference mode |
| Gemini API key | — | Cloud inference mode |

### Start ChromaDB

No Python needed — run it via npx:

```bash
bun run chroma:start     # npx chroma run --path ./.chroma-data --port 8000
```

Helper scripts:

| Script | What it does |
|---|---|
| `bun run chroma:start` | Start ChromaDB on `:8000` (foreground) |
| `bun run chroma:stop` | Stop ChromaDB |
| `bun run chroma:status` | Check if it's running |
| `bun run dev:full` | Start ChromaDB (background) + Next.js dev together |
| `bun run stop:all` | Stop both ChromaDB and the dev server |

Or with Docker:

```bash
docker run -p 8000:8000 chromadb/chroma
```

### Start Ollama (local inference only)

```bash
# Install: https://ollama.com
ollama serve
ollama pull llama3.1:8b   # or any model you prefer
```

### Get a Gemini API key (cloud inference only)

Visit [Google AI Studio](https://aistudio.google.com/apikey) → Create API key. You can paste it in the UI at runtime or set `GEMINI_API_KEY` in `.env`.

---

## Setup

```bash
# 1. Clone
git clone <repo-url>
cd arch-rag

# 2. Install dependencies
bun install

# 3. Configure (optional — defaults work for local ChromaDB + Ollama)
cp .env.example .env
# Edit .env if your services run on non-default ports or hosts

# 4. Run
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```env
# ChromaDB — change if not running on localhost:8000
CHROMADB_HOST=localhost
CHROMADB_PORT=8000

# Ollama — change if running on a remote host or non-standard port
OLLAMA_BASE_URL=http://localhost:11434/v1

# Gemini API key — alternative to entering it in the UI each time
# GEMINI_API_KEY=AIza...
```

---

## Codebase sources

| Source | Description |
|---|---|
| **Upload files** | Drag-and-drop individual files from your machine |
| **Local directory** | Absolute path to any directory on the server's filesystem |

The indexer automatically ignores `node_modules`, `.git`, `dist`, `build`, `.next`, lock files, `.env*` files, and any patterns defined in `.gitignore`, `.agentignore`, or `.dockerignore` found in the target directory.

---

## Inference providers

| Provider | Setup | Privacy |
|---|---|---|
| **Ollama (local)** | `ollama serve` + pull a model | Zero data leaves your machine |
| **Gemini (cloud)** | Paste API key in UI or set `GEMINI_API_KEY` | Code sent to Google |

### Supported Gemini models

| Model | Best for |
|---|---|
| `gemini-3.5-flash` | Latest, best reasoning — recommended default |
| `gemini-3.1-flash-lite` | Fastest, lowest cost |
| `gemini-2.5-flash` | Stable price-performance |
| `gemini-2.5-flash-lite` | Budget, high-throughput |
| `gemini-2.5-pro` | Most powerful, complex audits |

---

## Development

```bash
bun dev          # dev server with hot reload
bun test         # run unit tests (Vitest)
bun run build    # production build
```

### Tech stack

- **Next.js 16** (App Router, Turbopack)
- **Vercel AI SDK v6** — `streamText` + `Output.object` for typed streaming, `useObject` on the client
- **`@xenova/transformers`** — local embeddings (all-MiniLM-L6-v2, ONNX)
- **ChromaDB** — vector store, one collection per session
- **Zod v4** — audit schema shared between server and client
- **`@ai-sdk/openai`** — Ollama via OpenAI-compatible API
- **`@ai-sdk/google`** — Gemini via Google Generative AI API
- **Tailwind CSS v4**
- **Vitest** — unit tests for chunker and prompt builder

### Project structure

```
app/
  api/audit/route.ts     — stream structured audit JSON (Ollama or Gemini)
  api/index/route.ts     — index pipeline, SSE progress stream
  api/models/route.ts    — list available Ollama models
  api/config/route.ts    — reports whether GEMINI_API_KEY is set (never the key)
  page.tsx               — wizard (source + provider selection)
  audit/page.tsx         — live audit results dashboard (with sessionStorage caching)
components/
  wizard/                — source selector, model selector, Gemini config, run button
  dashboard/             — audit header, metrics strip, module cards
  ui/                    — complexity bar, risk badge, skeleton card, vulnerability chip
lib/
  chunker.ts             — overlapping text chunker
  embedder.ts            — local MiniLM embeddings (lazy-loaded)
  chromadb.ts            — store and query ChromaDB collections
  prompt.ts              — system + user prompt builders
  schema.ts              — Zod schema (AuditSchema, ModuleSchema, ComponentSchema)
  sources/
    shared.ts            — unified extensions, ignore patterns, path/URL validation
    directory.ts         — gitignore-aware directory extraction
    upload.ts            — multipart file upload extraction
```

---

## Privacy notes

- Embeddings always run locally — your code is never sent to any embedding API.
- **Ollama mode**: the entire pipeline is local. Nothing leaves your machine.
- **Gemini mode**: chunk text is sent to Google's API for inference only. The Gemini API key is stored in `sessionStorage` for the duration of the browser session (or in `.env` if you set it there) — it is never logged, never put in a URL, and never persisted by the app server. If `GEMINI_API_KEY` is set in `.env`, the UI detects it (via `/api/config`, which returns only a boolean) and makes the key input optional; a key typed in the UI always overrides the server key.
- ChromaDB persists embeddings and chunk text to disk under `./.chroma-data` (git-ignored). Sessions are not cleaned up automatically.

# FlowBrain

[English](README.md) | [한국어](README.ko-KR.md)

FlowBrain is an AI-assisted workspace for personal notes and lightweight sales records. It combines authenticated CRUD flows with retrieval-augmented chat, so a user can ask natural-language questions across their own stored data and let the assistant trigger product actions such as finding notes, checking sales history, or guiding note creation through an interactive tool flow.

The project is intentionally compact, but it is built like a real application surface: authenticated routes, persisted domain data, vector search, AI tool calling, streaming chat UI, schema validation, and a modern type/lint/build pipeline.

## Highlights

- **AI chat over private user data** — chat requests are scoped to the signed-in user and enriched with relevant notes or sales records retrieved through Pinecone.
- **Tool-driven product actions** — the assistant can call domain tools for note lookup, note creation, date-range awareness, and sales-record retrieval.
- **Human-in-the-loop creation flow** — note creation can pause for confirmation or render an input UI when the prompt is missing required fields.
- **Streaming chat interface** — responses stream through the Vercel AI SDK UI message protocol.
- **Authenticated app shell** — Clerk protects the service area and separates each user's data.
- **Persistent storage** — Prisma models notes and sales records on MongoDB.
- **Modern UI foundation** — Next.js App Router, React 19, Tailwind CSS 4, shadcn/Base UI components, and dark-mode support.
- **Quality gate** — pnpm, TypeScript, Biome, Husky, and production builds are wired into the developer workflow.

## Product overview

FlowBrain has two primary work areas:

### Notes

Users can create, edit, and delete notes. Each note is embedded and indexed, making it available to the assistant for semantic retrieval. The chat assistant can:

- find relevant notes for a query,
- answer questions from note context,
- ask for confirmation before creating a note,
- render a note input UI when required information is missing.

### Sales records

Users can store simple sales records with product name, price, and sold date. These records are also embedded and retrievable through chat. The assistant can answer natural-language questions about the user's sales data and can constrain lookups by user-local dates.

## Architecture

```txt
Browser
  ├─ Next.js App Router pages
  ├─ Clerk-authenticated service shell
  └─ AIChatBox
       ├─ @ai-sdk/react useChat
       ├─ DefaultChatTransport
       └─ typed tool-* UI parts

Next.js API routes
  ├─ /api/notes       CRUD notes + vector upsert/delete
  ├─ /api/sales       CRUD sales records + vector upsert/delete
  └─ /api/chat        AI orchestration route
       ├─ auth boundary
       ├─ UIMessage -> ModelMessage conversion
       ├─ OpenAI chat model calls
       ├─ OpenAI embeddings
       ├─ Pinecone vector retrieval
       ├─ Prisma user data lookup
       └─ AI SDK tool execution / UI message stream response

Data layer
  ├─ MongoDB via Prisma
  └─ Pinecone vector index
```

## AI flow

The chat route follows a retrieval and tool-calling pipeline:

1. Read AI SDK `UIMessage[]` from the request.
2. Authenticate the request with Clerk before any provider or database work.
3. Extract user-visible text from message parts.
4. Generate an OpenAI embedding for recent chat context.
5. Classify the user query as `notes`, `sales`, or `general`.
6. Query Pinecone with user-scoped metadata filters.
7. Fetch matching records from MongoDB through Prisma.
8. Stream an answer with `streamText`.
9. Let the assistant call typed tools when the request should use a product action.
10. Return a `toUIMessageStreamResponse` stream to the client.

The implementation uses explicit `openai.chat("gpt-4o")` for language-model calls to preserve Chat Completions-style behavior while still running on the current Vercel AI SDK. Embeddings remain on `text-embedding-ada-002` to avoid invalidating existing Pinecone vectors.

## AI tools

The assistant has access to domain-specific tools:

| Tool | Purpose |
| --- | --- |
| `getNotes` | Retrieve semantically relevant notes, optionally filtered by date range. |
| `makeNote` | Create a note and insert its embedding into Pinecone. |
| `askForConfirmation` | Ask the user to confirm note creation before committing the action. |
| `renderNoteUI` | Render a small form in chat when title/content is missing. |
| `getUserDatetime` | Provide the user's local day boundaries for date-aware queries. |
| `getSalesRecord` | Retrieve semantically relevant sales records, optionally filtered by date range. |

Client-only tools are typed from the server tool definitions using AI SDK `InferUITools`, so the browser's `addToolOutput` payloads stay aligned with the server-side tool contract.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS 4, shadcn/Base UI |
| Auth | Clerk |
| AI orchestration | Vercel AI SDK 6 |
| Model provider | OpenAI via `@ai-sdk/openai` |
| Vector search | Pinecone |
| Database | MongoDB with Prisma |
| Forms | React Hook Form + Zod |
| Quality | TypeScript, Biome, Husky |
| Package manager | pnpm |

## Notable implementation details

- **Auth-first AI route**: `/api/chat` returns unauthorized responses before embeddings, classifier calls, Pinecone queries, or Prisma reads.
- **User-scoped retrieval**: Pinecone queries include `userId` metadata filters so chat context is scoped to the authenticated user.
- **UI message protocol**: server responses use AI SDK UI message streams; the client renders typed `tool-*` parts.
- **Tool continuation**: client tool outputs use `addToolOutput` and `lastAssistantMessageIsCompleteWithToolCalls` to resume the assistant loop after user interaction.
- **Embedding compatibility**: the app preserves the current embedding model unless a separate vector reindex migration is planned.
- **Typecheck-first linting**: `pnpm lint` runs `tsc --noEmit` before Biome, catching SDK contract drift that lint-only checks miss.

## Getting started

### Prerequisites

- Node.js compatible with the current Next.js version
- pnpm
- MongoDB database
- Pinecone index
- Clerk application
- OpenAI API key

### Environment variables

Create `.env` with the values required by the app:

```bash
DATABASE_URL=
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_DB_INDEX_NAME=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Depending on your Clerk setup, you may also want the usual sign-in/sign-up redirect variables.

### Install

```bash
pnpm install
```

`postinstall` runs Prisma client generation.

### Run locally

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

### Build

```bash
pnpm build
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run type/lint gate, then start the Next.js dev server with inspector enabled. |
| `pnpm build` | Build the production app. |
| `pnpm start` | Start the production server after a build. |
| `pnpm typecheck` | Run TypeScript without emitting files. |
| `pnpm lint` | Run TypeScript and Biome lint. |
| `pnpm biome` | Run TypeScript and full Biome check. |
| `pnpm pret` | Check formatting with Biome formatter. |
| `pnpm pret:fix` | Apply Biome formatting. |

## Project structure

```txt
src/app
  api/chat        AI orchestration route
  api/notes       notes API and AI note tools
  api/sales       sales API and AI sales tools
  services        authenticated product pages

src/components
  AIChatBox       streaming chat and client-side tool UI
  AddEditNoteDialog
  AddSalesRecordDialog
  ui              shadcn/Base UI primitives

src/lib
  db              Prisma and Pinecone clients
  validation      Zod schemas
  openai.ts       embedding helper

prisma
  schema.prisma   MongoDB models
```

## Current limitations

- The project is a compact portfolio/product prototype, not a full production SaaS.
- Authenticated browser QA is still the best way to validate the full AI tool loop end-to-end.
- The embedding model is intentionally not upgraded; doing so requires re-embedding existing data.
- Sales records are intentionally simple and currently model only product name, amount, and sold date.

## Future improvements

- Add automated tests around message text extraction, classifier fallback, and tool-output contracts.
- Add observability around AI calls, vector lookup latency, and tool invocation outcomes.
- Add a dedicated migration for newer OpenAI Responses API behavior if the product should adopt it.
- Add a Pinecone reindex path before changing embedding models.
- Improve empty states and onboarding for demo users.
- Add screenshots or a short product demo once the UI is finalized.

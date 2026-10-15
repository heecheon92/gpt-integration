# FlowBrain

[English](README.md) | [한국어](README.ko-KR.md)

FlowBrain은 개인 노트와 간단한 판매 기록을 관리하기 위한 AI 기반 워크스페이스입니다. 인증된 CRUD 흐름과 검색 증강 채팅을 결합해, 사용자가 자신의 저장 데이터에 대해 자연어로 질문하고 assistant가 노트 검색, 판매 내역 조회, 노트 생성 보조 같은 제품 액션을 수행할 수 있도록 합니다.

프로젝트 규모는 작지만 실제 애플리케이션 표면처럼 구성되어 있습니다. 인증 라우트, 영속 도메인 데이터, 벡터 검색, AI 툴 호출, 스트리밍 채팅 UI, 스키마 검증, 타입/린트/빌드 파이프라인을 포함합니다.

## 주요 기능

- **개인 데이터 기반 AI 채팅** — 채팅 요청은 로그인한 사용자 범위로 제한되며 Pinecone에서 검색한 관련 노트 또는 판매 기록으로 보강됩니다.
- **툴 기반 제품 액션** — assistant는 노트 조회, 노트 생성, 날짜 범위 인식, 판매 기록 조회 같은 도메인 툴을 호출할 수 있습니다.
- **Human-in-the-loop 생성 흐름** — 노트 생성 전에 확인을 요청하거나, 필수 정보가 부족하면 채팅 안에서 입력 UI를 렌더링합니다.
- **스트리밍 채팅 인터페이스** — Vercel AI SDK UI message 프로토콜을 통해 응답을 스트리밍합니다.
- **인증된 앱 셸** — Clerk가 서비스 영역을 보호하고 사용자별 데이터를 분리합니다.
- **영속 저장소** — Prisma가 MongoDB의 노트와 판매 기록 모델을 관리합니다.
- **현대적인 UI 기반** — Next.js App Router, React 19, Tailwind CSS 4, shadcn/Base UI 컴포넌트, 다크 모드를 사용합니다.
- **품질 게이트** — pnpm, TypeScript, Biome, Husky, production build가 개발 흐름에 연결되어 있습니다.

## 제품 개요

FlowBrain에는 두 가지 주요 작업 영역이 있습니다.

### Notes

사용자는 노트를 생성, 수정, 삭제할 수 있습니다. 각 노트는 임베딩되어 인덱싱되며, assistant가 semantic retrieval에 사용할 수 있습니다. 채팅 assistant는 다음을 수행할 수 있습니다.

- 질문과 관련된 노트 찾기
- 노트 컨텍스트를 바탕으로 답변하기
- 노트 생성 전 사용자 확인 요청하기
- 필요한 정보가 부족할 때 노트 입력 UI 렌더링하기

### Sales records

사용자는 제품명, 가격, 판매일로 구성된 간단한 판매 기록을 저장할 수 있습니다. 이 기록 역시 임베딩되어 채팅으로 검색할 수 있습니다. assistant는 사용자의 판매 데이터에 관한 자연어 질문에 답하고, 사용자 로컬 날짜 기준으로 조회 범위를 제한할 수 있습니다.

## 아키텍처

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

## AI 흐름

채팅 라우트는 retrieval과 tool calling을 결합한 파이프라인으로 동작합니다.

1. 요청에서 AI SDK `UIMessage[]`를 읽습니다.
2. provider 또는 database 작업 전에 Clerk로 요청을 인증합니다.
3. message part에서 사용자가 볼 수 있는 텍스트를 추출합니다.
4. 최근 채팅 컨텍스트에 대해 OpenAI 임베딩을 생성합니다.
5. 사용자 쿼리를 `notes`, `sales`, `general` 중 하나로 분류합니다.
6. 사용자 스코프 metadata filter로 Pinecone을 조회합니다.
7. Prisma를 통해 MongoDB에서 매칭된 레코드를 가져옵니다.
8. `streamText`로 답변을 스트리밍합니다.
9. 제품 액션이 필요한 요청에서는 assistant가 typed tool을 호출합니다.
10. `toUIMessageStreamResponse` 스트림을 클라이언트에 반환합니다.

구현은 현재 Vercel AI SDK를 사용하면서도 기존 Chat Completions 스타일 동작을 보존하기 위해 language model 호출에 명시적으로 `openai.chat("gpt-4o")`를 사용합니다. Pinecone 벡터 호환성을 유지하기 위해 임베딩은 `text-embedding-ada-002`를 유지합니다.

## AI tools

assistant는 다음 도메인 툴을 사용할 수 있습니다.

| Tool | Purpose |
| --- | --- |
| `getNotes` | 관련 노트를 semantic하게 조회하고, 선택적으로 날짜 범위를 적용합니다. |
| `makeNote` | 노트를 생성하고 해당 임베딩을 Pinecone에 저장합니다. |
| `askForConfirmation` | 노트 생성 전에 사용자 확인을 요청합니다. |
| `renderNoteUI` | 제목 또는 내용이 부족할 때 채팅 안에 작은 입력 폼을 렌더링합니다. |
| `getUserDatetime` | 날짜 인식 쿼리를 위해 사용자의 로컬 날짜 경계를 제공합니다. |
| `getSalesRecord` | 관련 판매 기록을 semantic하게 조회하고, 선택적으로 날짜 범위를 적용합니다. |

클라이언트 전용 툴은 AI SDK `InferUITools`를 사용해 서버 툴 정의에서 타입을 가져옵니다. 덕분에 브라우저의 `addToolOutput` payload가 서버 측 툴 계약과 어긋나지 않도록 유지됩니다.

## 기술 스택

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

## 구현 포인트

- **Auth-first AI route**: `/api/chat`는 임베딩, classifier 호출, Pinecone 쿼리, Prisma 조회 전에 인증되지 않은 요청을 반환합니다.
- **User-scoped retrieval**: Pinecone 쿼리에 `userId` metadata filter를 포함해 채팅 컨텍스트를 로그인한 사용자 데이터로 제한합니다.
- **UI message protocol**: 서버 응답은 AI SDK UI message stream을 사용하며, 클라이언트는 typed `tool-*` part를 렌더링합니다.
- **Tool continuation**: 클라이언트 툴 출력은 `addToolOutput`과 `lastAssistantMessageIsCompleteWithToolCalls`를 사용해 사용자 상호작용 후 assistant loop를 재개합니다.
- **Embedding compatibility**: 별도 벡터 reindex migration이 없다면 현재 임베딩 모델을 유지합니다.
- **Typecheck-first linting**: `pnpm lint`는 Biome 전에 `tsc --noEmit`을 실행해 SDK 계약 변경을 lint-only 체크보다 먼저 잡습니다.

## 시작하기

### Prerequisites

- 현재 Next.js 버전과 호환되는 Node.js
- pnpm
- MongoDB database
- Pinecone index
- Clerk application
- OpenAI API key

### Environment variables

`.env` 파일에 다음 값을 설정합니다.

```bash
DATABASE_URL=
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_DB_INDEX_NAME=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Clerk 설정에 따라 일반적인 sign-in/sign-up redirect 변수도 추가로 사용할 수 있습니다.

### Install

```bash
pnpm install
```

`postinstall`에서 Prisma client generation이 실행됩니다.

### Run locally

```bash
pnpm dev
```

브라우저에서 다음 주소를 엽니다.

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
| `pnpm dev` | type/lint gate를 실행한 뒤 inspector가 켜진 Next.js dev server를 시작합니다. |
| `pnpm build` | production app을 빌드합니다. |
| `pnpm start` | 빌드 후 production server를 시작합니다. |
| `pnpm typecheck` | 파일을 emit하지 않고 TypeScript를 실행합니다. |
| `pnpm lint` | TypeScript와 Biome lint를 실행합니다. |
| `pnpm biome` | TypeScript와 전체 Biome check를 실행합니다. |
| `pnpm pret` | Biome formatter로 formatting을 검사합니다. |
| `pnpm pret:fix` | Biome formatting을 적용합니다. |

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

## 현재 한계

- 이 프로젝트는 full production SaaS라기보다 compact portfolio/product prototype입니다.
- 전체 AI tool loop의 end-to-end 검증은 로그인된 브라우저 환경에서 수행하는 것이 가장 좋습니다.
- 임베딩 모델은 의도적으로 업그레이드하지 않았습니다. 변경하려면 기존 데이터를 다시 임베딩해야 합니다.
- 판매 기록은 의도적으로 단순하며 현재 제품명, 금액, 판매일만 모델링합니다.

## 향후 개선 아이디어

- message text extraction, classifier fallback, tool-output contract에 대한 자동화 테스트 추가
- AI 호출, 벡터 조회 latency, tool invocation 결과에 대한 observability 추가
- 제품 요구가 있다면 최신 OpenAI Responses API 동작을 별도 migration으로 검토
- 임베딩 모델 변경 전 Pinecone reindex path 추가
- 데모 사용자를 위한 empty state와 onboarding 개선
- UI가 안정화된 뒤 screenshot 또는 짧은 product demo 추가

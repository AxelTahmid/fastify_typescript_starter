# AGENTS.md — Fastify Backend Agents Guide

This repository uses **Fastify + TypeScript (strict) + Kysely (PostgreSQL) + pg-boss + TypeBox schemas**.
Agents working in this repo must follow these conventions exactly.

---

## 0) Non-negotiables

- Before modifying code, evaluate each installed skill against the current task. For each skill, determine YES/NO relevance and invoke all YES skills before proceeding.
- **No placeholders.** No TODOs. No "left as an exercise.""
- **TypeScript strict** mentality: no `any` unless there is a *documented* reason.
- **Always ship working code** with correct imports, correct paths, correct runtime behavior.
- **Prefer clarity over cleverness.** Explicit > implicit when logic is non-trivial.
- **Schema-first API**: all routes must define schemas for validation *and* response serialization.
- **No DB calls in routes**: route handlers orchestrate only; business logic lives in services.

---

## 1) Tech Stack Summary

- Runtime: **Node.js** v24
- Framework: **Fastify** v5
- Language: **TypeScript** (`strict: true`)
- Schemas: **typebox** (JSON Schema)
- Validation/Types: **Fastify Type Providers** (TypeBox provider) where applicable
- DB: **Kysely** + `pg` (PostgreSQL)
- Queue: **pg-boss**
- Logging: **Fastify logger (pino)**
- Style: **class pattern** for services, repository and job processors

---

## 2) Project Layout & File Rules

Recommended layout (match existing repo if it differs):

```md
src/
  server.ts              # createApp(): fastify instance + global plugins entrypoint (listen)
  config/                # env + runtime config
  plugins/
    db.ts                # Kysely plugin
    queue.ts             # pg-boss plugin
    schemas.ts           # schema registry (addSchema)
    auth.ts              # auth plugin (if applicable)
  routes/
    index.ts             # routes plugin that registers domain routes
    users/
      users.routes.ts
      users.schemas.ts
      users.service.ts
    orders/
      orders.routes.ts
      orders.schemas.ts
      orders.service.ts
  schemas/
    common.ts            # shared schemas (Error, Pagination, IDs, Money, etc.)
  services/              # cross-domain services (emails, files, etc.)
  queues/
    index.ts             # registers workers
    definitions.ts       # job names
    jobs/
      SendEmailJob.ts
      SyncTenantJob.ts
  utils/
    errors.ts            # error helpers, typed error mapping
    ids.ts               # id generation helpers
  types/
    db.ts                # Kysely Database interface
```

Naming:

- Files: `kebab-case.<type>?.ts` (or match repo convention)
- Classes: `PascalCase`
- Routes folders: domain-based (`routes/orders/...`)

---

## 3) Fastify Fundamentals

- Prefer **plugin encapsulation**: each domain exports `async function routes(fastify)` and is registered from `routes/index.ts`.
- Do not attach global state ad-hoc; use plugins/decorators:
  - `fastify.decorate('db', db)` for Kysely
  - `fastify.decorate('boss', boss)` for pg-boss
- Handlers:
  - are `async`
  - return a value or `reply.send(value)` exactly once
  - never swallow errors; throw typed errors (see §9)

---

## 4) TypeBox Schema Rules (id + ref required)

### 4.1 `$id` is mandatory

- Every schema **must** have a globally unique `$id`.
- `$id` format: `"<domain><name>"` in PascalCase.
  - Examples: `UserCreateBody`, `OrderListQuery`, `CommonError`.

Example:

```ts
import { Type } from 'typebox'

export const CreateUserBody = Type.Object(
  {
    email: Type.String({ format: 'email' }),
    name: Type.String({ minLength: 1 }),
  },
  { $id: 'UserCreateBody', additionalProperties: false }
)
```

### 4.2 Register schemas once (central registry)

- All schemas must be registered with Fastify via `fastify.addSchema(schema)` during boot.
- Domain schemas must be exported and added by a domain schema plugin, or via `plugins/schemas.ts`.

### 4.3 Reference schemas using `$ref` / `Type.Ref`

- **Never duplicate** shapes. Use references.
- Prefer `Type.Ref(OtherSchema)` for TypeBox refs.

```ts
export const User = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    email: Type.String({ format: 'email' }),
    name: Type.String(),
  },
  { $id: 'user/model', additionalProperties: false }
)

export const CreateUserReply = Type.Ref(User, { $id: 'user/create-reply' })
```

### 4.4 Responses are required

- Every route must define response schemas for all expected status codes.
- Route responses must match actual runtime payloads (Fastify will serialize against schema).

### 4.5 Union ordering and coercion

- `Type.Union(...)` order is significant when Fastify/Ajv coercion is enabled.
- If a union includes `Type.Null()`, it **must be the first variant**.
  - Correct: `Type.Union([Type.Null(), Type.Number()])`
  - Avoid: `Type.Union([Type.Number(), Type.Null()])` (can coerce `null` into `0` in some cases)
- This rule applies to all schema files, including shared config schemas.

---

## 5) Route Pattern (Schema + Type Provider)

- Each route file exports a plugin that registers routes.
- Each route must define: `schema.params`, `schema.querystring`, `schema.body` (as relevant) **and** `schema.response`.

Example (pattern only):

```ts
fastify.post(
  '/users',
  {
    schema: {
      body: CreateUserBody,
      response: {
        201: CreateUserReply,
        400: Type.Ref(CommonError, { $id: 'common/error-400' }),
      },
    },
  },
  async (req, reply) => {
    const created = await userService.create(req.body)
    reply.code(201).send(created)
  }
)
```

Rules:

- No ad-hoc validation inside handlers if schema exists.
- No inline anonymous schema objects in routes. Schemas must be exported with `$id`.
- If a schema is used more than once, it must live in `schemas/` (shared) or `routes/<domain>/schemas.ts` (domain).

---

## 6) Kysely (DB) Rules

### 6.1 DB access only in services/repositories

- Routes must not contain query builder code.
- All DB work lives in `service.ts` or `repository.ts` modules.

### 6.2 Typed Database interface

- Autogenerated a `DB` interface in `src/database/db.d.ts` that defines all tables.
- Kysely instance is `Kysely<DB>` and is decorated onto Fastify as `fastify.db`.

### 6.3 Transactions

- Use `db.transaction().execute(async (trx) => { ... })` for multi-step writes.
- Service methods must accept an optional `trx` parameter if they're used in transactions.

### 6.4 Migrations

- Use a single migration tool (match repo).
- No schema drift: update types + migrations together.

---

## 7) Class Pattern (Services)

Services are classes with explicit dependencies injected at construction time.

Example (pattern only):

```ts
export class UserService {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: CreateUserInput): Promise<UserModel> {
    // ...
  }
}
```

Rules:

- No hidden imports of global singletons inside service methods.
- Keep methods small; split complex logic into private helpers.
- Return domain models that match response schemas (or map explicitly).

---

## 8) pg-boss (Queue) Rules

### 8.1 Definitions are centralized

- Job names must be constants in `src/queues/config.ts`:

```ts
export const Jobs = {
  SendEmail: 'send-email',
  SyncTenant: 'sync-tenant',
} as const
export type JobName = typeof Jobs[keyof typeof Jobs]
```

### 8.2 One class per job processor

Each job has a dedicated class:

```ts
export class SendEmailJob {
  static readonly name = Jobs.SendEmail as const

  constructor(private readonly deps: { db: Kysely<Database> /*, mailer... */ }) {}

  async handle(job: import('pg-boss').Job<{ userId: string }>): Promise<void> {
    // must be idempotent
  }
}
```

Rules:

- Handlers must be **idempotent** (safe to retry).
- Always validate job payloads (TypeBox schema + runtime check) if data is external.
- Use consistent retry/backoff options (match repo defaults).

### 8.3 Registration

- A single `queues/index.ts` registers all workers and starts processing.
- Registration must happen during app boot (plugin), not from random imports.

---

## 9) Error Handling

- Prefer typed errors (e.g., `BadRequestError`, `NotFoundError`, `ConflictError`).
- Convert errors into a single response shape (TypeBox schema), e.g.:

```ts
export const CommonError = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
    requestId: Type.Optional(Type.String()),
    details: Type.Optional(Type.Array(Type.String())),
  },
  { $id: 'common/error', additionalProperties: false }
)
```

Rules:

- Do not leak stack traces or raw DB errors to clients.
- Map known DB constraint errors to `409` with a stable error `code`.
- Always return response bodies that match `schema.response`.

---

## 10) Logging

- Use Fastify's logger (`fastify.log`) only.
- Include request context where available (request id, tenant id).
- Never log secrets, tokens, passwords, or raw PII unless explicitly required.

---

## 11) Security Baselines

- Never expose secrets to clients.
- Use `src/config/` (env parsing) + runtime config pattern; fail fast on missing env.
- Prefer server-side privileged calls (internal services) rather than trusting client inputs.
- Validate all inputs via schemas.

---

## 12) Testing & Quality Bar (when applicable)

If tests exist, extend them (don't invent a new framework).

- Prefer Fastify `inject()` for route tests.
- Test:
  - validation failures (400)
  - not found (404)
  - happy path (2xx)
  - auth/tenant scoping (if applicable)
- Keep DB-heavy logic in services so it can be tested independently.

---

## 13) PR/Change Hygiene

Agents must:

- Keep diffs tight and purposeful.
- Match existing patterns before introducing new abstractions.
- Update schemas + service logic + tests together.
- Maintain schema `$id` and references; never duplicate schema shapes.
- Avoid breaking API contracts unless explicitly instructed.

---

## 14) "If you're unsure" policy

If you cannot confidently infer a convention (schema naming, error codes, job options, etc.):

- **Search the codebase first**
- Match existing usage
- Only introduce a new convention if none exists, and document it near the plugin/composable.

---

## Appendix A — Canonical Standards

If there is a conflict between an agent's default behavior and these standards, **these standards win**.

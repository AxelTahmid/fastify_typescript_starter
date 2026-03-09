# Fastify TypeScript Starter

A production-oriented Fastify backend template built with TypeScript, PostgreSQL, Kysely, `pg-boss`, and a modular feature-first structure.

This repository is intended to be a public backend starter for engineers and teams who want a serious foundation without inheriting unnecessary framework complexity. It is designed to be understandable, composable, and durable under real product development, not just convenient for the first few endpoints.

The template is deliberately opinionated in a few places:

- the database is treated as a first-class part of the architecture
- infrastructure concerns are added through explicit Fastify plugins
- features are organized as small modules with clear boundaries
- contracts are typed and discoverable
- local development is expected to be easy to bootstrap and inspect

Those choices are there to keep the project maintainable as it grows from a starter into an actual application.

## What You Get

Out of the box, this template includes:

- Fastify 5 with TypeScript and ESM
- PostgreSQL as the primary application datastore
- Kysely for typed query building and migrations
- `pg-boss` for durable background job processing
- ES256 JWT authentication primitives
- MinIO / S3-compatible object storage support
- a small database-backed cache service
- OpenAPI 3.1 generation and Scalar documentation UI in development
- Docker Compose for the app, database, and local mail tooling
- Mailpit for inspecting local email flows
- Biome for linting and formatting
- Lefthook for lightweight Git hook automation
- Make targets for common setup, database, and runtime tasks

This is not meant to be a ready-made business product. It is a strong technical baseline you can extend with your own domain logic.

## Who This Template Is For

This template is a good fit if you are building:

- a backend for a web or mobile product
- an admin or internal API
- a content, membership, inventory, or commerce service
- a project where SQL is part of the engineering skillset
- a system that needs background jobs, file storage, auth, and API docs from the beginning

It is especially useful for teams that want:

- a backend that remains legible to senior engineers
- strong typing without hiding the data model behind heavy abstractions
- fewer moving parts in local development
- explicit patterns for where code should live
- a starter that can evolve directly into production code

## Philosophy

The template is guided by a few practical principles.

### Clarity Over Cleverness

Important behavior should be obvious from reading the code:

- how the server boots
- which plugins are registered
- where the database connection comes from
- how jobs are published
- where schemas are defined
- how requests turn into business logic

There is intentionally very little hidden behavior.

### Strong Defaults, Loose Extension

The template gives you a strong baseline, but it does not try to force every future design choice. You can add modules, plugins, tables, jobs, and integrations without fighting a framework-specific worldview.

### Typed Boundaries Reduce Drift

Types are most valuable at boundaries:

- request bodies
- response payloads
- queue payloads
- environment configuration
- database operations

The template leans into those boundaries so refactors stay safer and contracts stay visible.

### Operational Simplicity Matters

A backend is not only code. It is also how many services you need to run, debug, secure, and deploy. This template favors a simpler operational story so teams can spend more energy on product behavior.

## Architectural Shape

The codebase follows a practical layered module structure:

- `schema`: request and response contracts
- `handler`: HTTP-facing behavior and serialization
- `service`: business logic and orchestration
- `repository`: persistence logic

This structure is intentionally straightforward.

Handlers should be thin. They understand HTTP concerns such as request parsing, route-level behavior, and response shaping.

Services should own business rules. They are where workflows, side effects, and application decisions belong.

Repositories should own persistence concerns. They should know how to query or update data, but not how requests arrived or how responses are sent.

Schemas should describe contracts. They should not contain business behavior.

This separation is not about formality for its own sake. It is about keeping the codebase readable once the number of endpoints, entities, and workflows starts to grow.

## Why These Technology Choices

### Fastify

Fastify provides an excellent balance of performance, plugin composition, and low overhead. It is a strong fit for APIs that want explicit control over bootstrapping and infrastructure without committing to a much larger framework model.

The plugin system is one of the main reasons this template is built around Fastify. Cross-cutting capabilities such as auth, database access, queueing, caching, and mail transport can be added in one clear place and then consumed consistently throughout the application.

### TypeScript

TypeScript here is not just for editor autocomplete. It is used to make architectural boundaries harder to accidentally erode. When repositories, queue payloads, schemas, and route handlers are typed well, the project becomes safer to change over time.

### PostgreSQL

PostgreSQL is treated as the primary persistence layer and an important part of the system design, not just a database checkbox. It provides the foundation for:

- relational application data
- migrations
- queue durability
- lightweight cache persistence

That keeps the system easier to reason about, especially for teams that value a compact operational footprint.

### Kysely

Kysely is used because it gives typed SQL with very little abstraction tax. It lets you keep control over queries, table shape, and schema evolution while still gaining strong compile-time feedback.

That makes it a strong fit for backends where SQL is a real engineering tool rather than something to hide.

### `pg-boss`

Many real applications need background processing early:

- sending mail
- cleanup jobs
- async side effects
- delayed or retried work

`pg-boss` provides a durable queueing model that fits naturally into a PostgreSQL-backed application. For a template like this, that leads to a clean development and deployment story while still supporting serious queue workflows.

### TypeBox

TypeBox is used for request and response schemas because it works well with Fastify, supports schema reuse, and helps keep OpenAPI generation aligned with actual application contracts.

The template also auto-registers schemas so features can define their own contracts locally without centralizing everything into one giant schema file.

### S3-Compatible Storage

Object storage is a common need even in relatively small systems. Using an S3-compatible integration model keeps local and production behavior aligned and avoids vendor-specific application code for basic storage flows.

### Asymmetric JWT Keys

JWT signing is configured around ES256 keys. This is a good default for applications that want a cleaner separation between signing and verification concerns and want production secret handling to remain explicit.

## Project Structure

```text
src/
  app/
    auth/
      handler.ts
      repository.ts
      routes.ts
      schema.ts
      service.ts
      types.ts
    base/
    gallery/
  config/
    environment.ts
    schema.ts
  database/
    db.d.ts
    helpers.ts
    migrate.ts
    migrations/
  plugins/
    bcrypt.ts
    cache.ts
    db.ts
    jwt.ts
    nodemailer.ts
    pgboss.ts
    s3object.ts
    schemas.ts
  queue/
    base/
    templates/
    workers/
    config.ts
    index.ts
  routes.ts
  server.ts
```

### `src/app`

Feature code lives here. Each feature should own the code that defines its API surface and its business behavior. This keeps features cohesive and avoids turning the project into a split-by-technical-layer monolith where all repositories, all services, and all schemas live in distant global folders.

### `src/config`

Application-wide configuration and shared schema definitions belong here. Environment parsing is centralized so the rest of the codebase consumes normalized config instead of reading raw `process.env` directly.

### `src/database`

Database types, migration runner, migration files, and shared query helpers live here. This folder is intentionally explicit because schema evolution is one of the most important parts of a backend codebase.

### `src/plugins`

This is where infrastructure capabilities are attached to Fastify:

- database access
- queue manager
- cache service
- auth helpers
- mail transport
- storage client
- schema loader

Keeping these as plugins makes the boot process easy to inspect and keeps cross-cutting concerns from being reimplemented ad hoc in feature code.

### `src/queue`

Queue-related code is isolated here so the application can publish jobs without every feature needing to know `pg-boss` internals. Job definitions, queue configuration, workers, and queue-facing helper methods stay in one clear place.

## Conventions

### Path Aliases

The project uses these path aliases:

- `#app/*`
- `#config/*`
- `#database/*`
- `#plugins/*`
- `#queue/*`

These aliases are part of the template’s readability strategy. Use them consistently instead of deep relative import chains.

### Schema Discovery And Registration

At boot time, the schema loader scans:

- `src/config/schema.ts`
- any `schema.ts`, `schemas.ts`, `*.schema.ts`, or `*.schemas.ts` under `src/app`

If you want schemas to be registered globally, export them through a `models` array in the module file.

Best practices:

- give reusable schemas stable `$id` values
- avoid duplicate schema IDs
- keep feature-local contracts near the feature
- centralize only truly shared schema definitions

### Plugin Boundaries

Only create a plugin when the capability is truly cross-cutting. Not every utility belongs in `src/plugins`. If a helper is specific to one module, keep it in that module.

Good plugin candidates:

- shared infrastructure clients
- Fastify decorators
- request lifecycle integrations
- global schema registration
- runtime services used across features

### Single-Responsibility Migrations

Each migration should do one thing and one thing only.

Examples:

- create one enum
- create one table
- add one column
- add one index
- create one function
- create one trigger

This is an important discipline. It makes code review better, rollback logic clearer, and migration history far more useful over time.

## Local Development

### Requirements

- Node.js 24+
- Yarn 4+
- Docker / Docker Compose
- OpenSSL
- `mkcert` optional, but recommended for trusted local TLS certificates

### First-Time Setup

Run:

```sh
make init
```

This bootstraps the project by:

1. creating `.env` from `.env.example` if it does not exist
2. generating local TLS certificates
3. generating JWT signing keys
4. installing project dependencies
5. installing Git hooks through Lefthook
6. building and starting the local containers

The goal is to make the initial setup routine predictable and repeatable instead of relying on a long series of manual steps.

### Daily Commands

Common commands for day-to-day development:

```sh
make dev
yarn dev
yarn build
yarn test
yarn check
yarn format
```

### Docker Services

The default `docker-compose.yml` starts:

- `app` on `localhost:3000`
- PostgreSQL on `localhost:5432`
- Mailpit SMTP on `localhost:1025`
- Mailpit UI on `localhost:8025`

Mailpit is included because email-driven features are easier to build when local development already has a visible mail sink instead of requiring a real SMTP provider for every test.

## Database Workflow

Useful commands:

```sh
make db-migrate
make db-migrate-up
make db-migrate-down
make db-status
make db-types
make db-query SQL="SELECT * FROM auth_users"
make db-shell
make db-drop
```

The intended workflow is straightforward:

- write a focused migration
- run it locally
- regenerate types if needed
- review the schema change as part of the feature

Database types are there to improve development ergonomics, but the schema and migrations remain the real source of truth.

## Queue Workflow

When adding a new background job:

1. define the job name and payload type under `src/queue`
2. add queue configuration in `src/queue/config.ts`
3. implement a worker under `src/queue/workers`
4. expose a helper method from `src/queue/index.ts`
5. publish the job from application code through that helper

This structure keeps job publishing simple for feature modules and keeps queue behavior centralized.

Best practices for workers:

- keep them small
- make them idempotent where possible
- avoid burying complex business rules inside workers
- push formatting into templates or helpers when useful

## API Documentation

In development:

- Fastify Swagger generates the OpenAPI 3.1 spec
- Scalar serves the interactive API reference UI at `/openapi`
- basic auth protects the docs endpoint

Relevant environment variables:

- `OPENAPI_USER`
- `OPENAPI_PASS`

This gives teams documentation early without assuming public exposure is appropriate by default.

## Security And Runtime Defaults

### Helmet And CSP

Helmet is enabled and content security policy is configured explicitly. The template starts from restrictive defaults and expects applications to loosen policy deliberately when needed.

### Graceful Shutdown

The server uses `close-with-grace` and Fastify lifecycle hooks so the HTTP server, database pool, queue manager, and transports all get a proper shutdown path.

### Pressure Handling

`@fastify/under-pressure` is enabled so the application has baseline protection and visibility around event loop and memory pressure from the start.

### Environment Normalization

All runtime configuration is parsed in `src/config/environment.ts`. This is intentional. Backend configuration becomes much easier to reason about when values are normalized once and then consumed as typed config everywhere else.

## Best Practices For Extending The Template

### Add Features As Modules

For a new feature, create:

- `schema.ts`
- `types.ts`
- `repository.ts` when persistence is needed
- `service.ts` when business logic is needed
- `handler.ts`
- `routes.ts`

Then register the module in `src/routes.ts`.

This keeps each feature cohesive and discoverable.

### Keep Routes Thin

Routes should define endpoint shape and wire handlers. They should not become containers for business logic or persistence logic.

### Keep Services Focused On Behavior

Services should be where workflows live:

- validating state transitions
- coordinating side effects
- publishing jobs
- enforcing application rules

That keeps behavior reusable and easier to test.

### Keep Repositories Focused On Data Access

Repositories should encapsulate queries and persistence operations. They should not know about HTTP concerns, request objects, or response formatting.

### Keep Configuration Centralized

If a new feature needs configuration, add it to `src/config/environment.ts` rather than reading raw environment variables directly inside handlers or services.

### Prefer Simple Operational Additions

Before adding new infrastructure, ask whether the current system can solve the problem with the tools already present. Simpler systems are easier to operate, debug, and onboard onto.

## Public Template Goal

The aim of this repository is not to be the most abstract backend starter or the most feature-packed scaffold. The goal is to provide a backend foundation that is clear enough for experienced engineers, practical enough for real product work, and structured enough to keep scaling without becoming chaotic.

If you want a template that encourages explicit engineering decisions, typed contracts, deliberate schema evolution, and pragmatic modularity, this starter is built for that.

## Author

Created by Axel Tahmid.

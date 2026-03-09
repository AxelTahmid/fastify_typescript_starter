# Fastify TypeScript Starter

This template is the updated starter behind `acs-backend`, with the app-specific commerce modules removed and the infrastructure kept generic.

Included by default:

- Fastify 5 + TypeScript
- PostgreSQL with Kysely
- `pg-boss` background jobs
- Database-backed cache service
- MinIO / S3-compatible object storage adapter
- JWT auth with env-embedded keys
- Auto-registered shared schemas
- OpenAPI 3.1 docs with Scalar UI
- Docker Compose, Mailpit, Biome, Lefthook, and Makefile helpers

## Structure

```text
src/
  app/
    auth/
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

## Template Conventions

- Path aliases use `#app/*`, `#plugins/*`, `#database/*`, `#config/*`, and `#queue/*`.
- Schemas are auto-registered from `src/config/schema.ts` and any `schema.ts` / `*.schema.ts` files under `src/app`.
- TLS and JWT material are loaded from base64 environment variables instead of file reads at runtime.
- Queueing uses PostgreSQL via `pg-boss`, so Redis is no longer part of the starter.

## Development

Prerequisites:

- Node.js 24+
- Yarn 4+
- Docker / Docker Compose
- OpenSSL
- `mkcert` optional, but preferred for trusted local TLS

First-time setup:

```sh
make init
```

That will:

- copy `.env.example` to `.env` if needed
- generate local TLS certs
- generate JWT keys and write them into `.env`
- install dependencies and lefthook
- build and start the Docker services

Normal local startup after that:

```sh
make dev
```

Direct app commands:

```sh
yarn dev
yarn build
yarn check
yarn format
```

## Database

The starter ships with Kysely migrations and a generated DB typing file placeholder.

Useful commands:

```sh
make db-migrate
make db-migrate-up
make db-migrate-down
make db-status
make db-types
make db-shell
```

## Services

`docker-compose.yml` starts:

- `app` on port `3000`
- PostgreSQL on port `5432`
- Mailpit SMTP on `1025`
- Mailpit UI on `8025`

## API Docs

In development, Scalar UI is mounted at `/openapi` and protected with basic auth from:

- `OPENAPI_USER`
- `OPENAPI_PASS`

The raw OpenAPI document is available through Fastify Swagger registration.

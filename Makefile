# ═══════════════════════════════════════════════════════════════════════════
# Fastify TypeScript Starter — Makefile
#
# Run `make help` to list every target with its description.
# Targets are grouped into the sections below:
#
#   1. Help & Environment     — help, check-env, init
#   2. Certificates & Keys    — jwt, tls
#   3. Docker Lifecycle       — up, down, fresh, dev, enter, log
#   4. Database & Migrations  — db-migrate, db-reset, db-seed, db-types, …
#   5. Quality & CI           — check, format, typecheck, test
# ═══════════════════════════════════════════════════════════════════════════

# Load .env file if it exists
ifneq (,$(wildcard ./.env))
	include .env
	export
endif


# ═══════════════════════════════════════════════════════════════════════════
# 1. HELP & ENVIRONMENT
#    First-time setup: `make init` copies .env, generates keys, installs
#    dependencies, and boots the full docker stack.
# ═══════════════════════════════════════════════════════════════════════════

.PHONY: help
## help: Display this help message
help:
	@echo "Usage:"
	@echo "  make <target> [variables]"
	@echo ""
	@echo "Available targets:"
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':' | sed -e 's/^/ /'

.PHONY: check-env
## check-env: Ensure .env exists; if not, copy from .env.example
check-env:
	@test -f .env || cp .env.example .env

.PHONY: init
## init: Initialize environment, generate keys, and start containers
init:
	$(MAKE) check-env
	mkdir -p cert
	$(MAKE) tls
	$(MAKE) jwt
	yarn install
	npx lefthook install
	docker compose down --remove-orphans
	COMPOSE_BAKE=true docker compose build --no-cache
	docker compose up -d --build -V
	$(MAKE) log


# ═══════════════════════════════════════════════════════════════════════════
# 2. CERTIFICATES & KEYS
#    Keys and certs are written into .env as base64 one-liners — the app
#    decodes them at boot (config/env.ts), so no key files ship anywhere.
# ═══════════════════════════════════════════════════════════════════════════

.PHONY: jwt tls
## jwt: Generate ES256 JWT keys and write them into .env as base64 values
jwt:
	@echo "Generating JWT keys..."
	mkdir -p cert && \
	cd cert && \
	openssl ecparam -genkey -name prime256v1 -noout -out jwt-pvt.pem && \
	openssl ec -in jwt-pvt.pem -pubout -out jwt-pub.pem
	@echo "Updating .env with base64-encoded JWT keys"
	@grep -v -e '^JWT_PRIVATE_KEY=' -e '^JWT_PUBLIC_KEY=' .env > .env.tmp && mv .env.tmp .env
	@echo "" >> .env
	@echo JWT_PRIVATE_KEY="`openssl base64 -A -in cert/jwt-pvt.pem`" >> .env
	@echo JWT_PUBLIC_KEY="`openssl base64 -A -in cert/jwt-pub.pem`" >> .env

## tls: Generate local TLS files and write them into .env as base64 values
tls:
	@echo "Generating TLS certificates..."
	@mkdir -p cert
	@if command -v mkcert > /dev/null; then \
		echo "Using mkcert for trustable certificates..."; \
		mkcert -install; \
		mkcert -cert-file cert/tls.crt -key-file cert/tls.key localhost 127.0.0.1 ::1; \
	else \
		echo "mkcert not found, falling back to self-signed openssl..."; \
		MSYS_NO_PATHCONV=1 openssl req -nodes -newkey rsa:2048 -new -x509 \
			-keyout cert/tls.key -out cert/tls.crt -days 365 \
			-subj "/C=BD/ST=Dhaka/L=Dhaka/O=Starter/CN=localhost"; \
	fi
	@echo "Updating .env with base64-encoded TLS certs"
	@grep -v -e '^SERVER_TLS_CERT=' -e '^SERVER_TLS_KEY=' .env > .env.tmp && mv .env.tmp .env
	@echo "" >> .env
	@echo SERVER_TLS_CERT="`openssl base64 -A -in cert/tls.crt`" >> .env
	@echo SERVER_TLS_KEY="`openssl base64 -A -in cert/tls.key`" >> .env


# ═══════════════════════════════════════════════════════════════════════════
# 3. DOCKER LIFECYCLE
#    The compose stack: api, postgres, minio (object storage), mailpit
#    (SMTP catcher with web UI on :8025, minio console on :9001).
# ═══════════════════════════════════════════════════════════════════════════

.PHONY: up down fresh dev enter enter-db log log-db
## up: Start Docker containers
up:
	docker compose up -d

## down: Stop Docker containers
down:
	docker compose down

## fresh: Rebuild and restart Docker containers from scratch
fresh:
	$(MAKE) check-env
	docker compose down --remove-orphans
	COMPOSE_BAKE=true docker compose build --no-cache
	docker compose up -d --build -V
	$(MAKE) log

## dev: Restart containers and follow API logs
dev: down up log

## enter: Open a shell inside the API container
enter:
	docker exec -it api sh

## enter-db: Open a shell inside the database container
enter-db:
	docker exec -it db sh

## log: Follow logs for API container
log:
	docker logs -f api

## log-db: Follow logs for database container
log-db:
	docker logs -f db


# ═══════════════════════════════════════════════════════════════════════════
# 4. DATABASE & MIGRATIONS
#    Kysely migrations live in src/database/migrations. Every migrate
#    target regenerates src/database/db.d.ts via kysely-codegen so query
#    types never drift from the live schema.
#
#    `db-reset` = rollback all → migrate → seed ACL + admin. The ACL seed
#    reconciles the code-defined permission catalog into the database.
# ═══════════════════════════════════════════════════════════════════════════

kysely_codegen := npx kysely-codegen
kysely_migrate := npx tsx src/database/migrate.ts

.PHONY: db-migrate db-migrate-up db-migrate-down db-status db-reset db-seed db-types db-query db-shell db-drop
## db-migrate: Run all pending Kysely database migrations
db-migrate:
	@echo "Running all pending migrations..."
	@$(kysely_migrate) latest
	@$(MAKE) db-types

## db-migrate-up: Run next pending migration
db-migrate-up:
	@echo "Running next migration..."
	@$(kysely_migrate) up
	@$(MAKE) db-types

## db-migrate-down: Rollback last migration
db-migrate-down:
	@echo "Rolling back last migration..."
	@$(kysely_migrate) down
	@$(MAKE) db-types

## db-status: Show database migration status
db-status:
	@echo "Checking migration status..."
	@$(kysely_migrate) status

## db-reset: Rollback everything, re-migrate, and seed (ACL + admin)
db-reset:
	@echo "Resetting database..."
	@$(kysely_migrate) reset
	@$(MAKE) db-types

## db-seed: Sync ACL catalog to DB and ensure the seed admin exists
db-seed:
	@echo "Seeding ACL and admin user..."
	@npx tsx src/database/seed-acl.ts
	@npx tsx src/database/seed-admin.ts

## db-types: Generate TypeScript database types from the live schema
db-types:
	@echo "Generating Kysely DB types..."
	$(kysely_codegen) --exclude-pattern="queue.*" --out-file src/database/db.d.ts

## db-query: Execute SQL query inside the database container
db-query:
	@if [ -z "$(SQL)" ]; then \
		echo "Error: 'SQL' variable must be set. Usage: make db-query SQL=\"SELECT * FROM auth_users\""; \
		exit 1; \
	fi
	@CID=$$(docker ps -aq -f name=db) ; \
	test -n "$$CID" || (echo "db container not found or not running" && exit 1) ; \
	docker exec $$CID sh -c 'PGPASSWORD="$(DB_PASSWORD)" psql -U "$(DB_USER)" -d "$(DB_NAME)" -h localhost -p 5432 -c "$(SQL)"'

## db-shell: Open interactive psql session in container
db-shell:
	@CID=$$(docker ps -aq -f name=db) ; \
	test -n "$$CID" || (echo "db container not found or not running" && exit 1) ; \
	docker exec -it $$CID sh -c 'PGPASSWORD="$(DB_PASSWORD)" psql -U "$(DB_USER)" -d "$(DB_NAME)" -h localhost -p 5432'

## db-drop: Drop and recreate the development database
db-drop:
	@CID=$$(docker ps -aq -f name=db) ; \
	test -n "$$CID" || (echo "db container not found or not running" && exit 1) ; \
	docker exec $$CID sh -c 'PGPASSWORD="$(DB_PASSWORD)" dropdb -U "$(DB_USER)" -h localhost -p 5432 --if-exists --force "$(DB_NAME)"' ; \
	docker exec $$CID sh -c 'PGPASSWORD="$(DB_PASSWORD)" createdb -U "$(DB_USER)" -h localhost -p 5432 "$(DB_NAME)"'


# ═══════════════════════════════════════════════════════════════════════════
# 5. QUALITY & CI
#    The same gates CI runs — use them locally before pushing.
# ═══════════════════════════════════════════════════════════════════════════

.PHONY: check format typecheck test
## check: Lint and format check with Biome
check:
	yarn check

## format: Auto-fix lint and formatting with Biome
format:
	yarn format

## typecheck: TypeScript type checking without emitting
typecheck:
	yarn typecheck

## test: Build and run the full test suite
test:
	yarn test

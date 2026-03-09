# Load .env file if it exists
ifneq (,$(wildcard ./.env))
	include .env
	export
endif

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

.PHONY: jwt tls
## jwt: Generate JWT keys and write them into .env as base64 values
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

.PHONY: up down fresh init dev enter enter-db log log-db
## up: Start Docker containers
up:
	docker compose up -d

## down: Stop Docker containers
down:
	docker compose down

## fresh: Rebuild and restart Docker containers
fresh:
	$(MAKE) check-env
	docker compose down --remove-orphans
	COMPOSE_BAKE=true docker compose build --no-cache
	docker compose up -d --build -V
	$(MAKE) log

## init: Initialize environment and start containers
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

## dev: Development mode
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

kysely_codegen := npx kysely-codegen
kysely_migrate := npx tsx src/database/migrate.ts

.PHONY: db-migrate db-migrate-up db-migrate-down db-status db-types db-query db-shell db-drop
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

## db-types: Generate TypeScript database types
db-types:
	@echo "Generating Kysely DB types..."
	$(kysely_codegen) --out-file src/database/db.d.ts

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

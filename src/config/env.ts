import "dotenv/config"
import { Type } from "typebox"
import { Value } from "typebox/value"

/**
 * Raw environment schema. Every variable the app reads is declared here.
 * Value.Parse pipeline: defaults are applied, strings are converted to
 * numbers/booleans, unknown keys are stripped, then the result is asserted.
 * A typo'd or malformed variable stops boot with a readable error instead
 * of silently falling back to a default.
 */
const EnvSchema = Type.Object({
    NODE_ENV: Type.Union([Type.Literal("development"), Type.Literal("production"), Type.Literal("test")], {
        default: "development",
    }),

    HOST: Type.String({ default: "0.0.0.0" }),
    PORT: Type.Number({ default: 3000, minimum: 1, maximum: 65535 }),

    SERVER_TLS_CERT: Type.Optional(Type.String()),
    SERVER_TLS_KEY: Type.Optional(Type.String()),
    SERVER_KEEP_ALIVE_TIMEOUT: Type.Number({ default: 60000 }),
    SERVER_REQUEST_TIMEOUT: Type.Number({ default: 30000 }),
    SERVER_BODY_LIMIT: Type.Number({ default: 5 * 1024 * 1024 }),

    DB_NAME: Type.String({ default: "starterdb" }),
    DB_USER: Type.String({ default: "starteruser" }),
    DB_PASSWORD: Type.Optional(Type.String()),
    DB_HOST: Type.String({ default: "localhost" }),
    DB_PORT: Type.Number({ default: 5432 }),
    DB_APP_NAME: Type.String({ default: "fastify-starter" }),
    DB_TIMEZONE: Type.String({ default: "UTC" }),
    PG_CONNECTION_STRING: Type.Optional(Type.String()),
    DB_CONNECTION_STRING: Type.Optional(Type.String()),
    DATABASE_URL: Type.Optional(Type.String()),

    DB_POOL_MIN: Type.Number({ default: 1 }),
    DB_POOL_MAX: Type.Number({ default: 10 }),
    DB_POOL_IDLE_TIMEOUT: Type.Number({ default: 10000 }),
    DB_POOL_CONNECTION_TIMEOUT: Type.Number({ default: 5000 }),
    DB_QUERY_TIMEOUT: Type.Number({ default: 30000 }),
    DB_LOCK_TIMEOUT: Type.Number({ default: 5000 }),
    DB_STATEMENT_TIMEOUT: Type.Number({ default: 30000 }),
    DB_KEEP_ALIVE_INITIAL_DELAY: Type.Number({ default: 30000 }),
    DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT: Type.Number({ default: 30000 }),

    PGBOSS_APP_NAME: Type.String({ default: "fastify-starter-queue" }),
    PGBOSS_SCHEMA: Type.String({ default: "queue" }),
    PGBOSS_MIGRATE: Type.Boolean({ default: true }),
    PGBOSS_MAX_CONN: Type.Number({ default: 5 }),
    PGBOSS_ARCHIVE_COMPLETED_AFTER: Type.Number({ default: 60 * 60 * 12 }),
    PGBOSS_ARCHIVE_FAILED_AFTER: Type.Number({ default: 60 * 60 * 12 }),
    PGBOSS_DELETE_AFTER_DAYS: Type.Number({ default: 7 }),
    PGBOSS_MONITOR_INTERVAL: Type.Number({ default: 5 }),

    S3_ENDPOINT: Type.String({ default: "http://localhost:9000" }),
    S3_PUBLIC_ENDPOINT: Type.Optional(Type.String()),
    S3_REGION: Type.String({ default: "us-east-1" }),
    S3_BUCKET: Type.String({ default: "starter" }),
    S3_ACCESS_KEY: Type.Optional(Type.String()),
    S3_SECRET_PASSWORD: Type.Optional(Type.String()),

    SMTP_HOST: Type.String({ default: "localhost" }),
    SMTP_PORT: Type.Number({ default: 1025 }),
    SMTP_SECURE: Type.Boolean({ default: false }),
    SMTP_POOL: Type.Boolean({ default: false }),
    SMTP_MAX_CONNECTIONS: Type.Number({ default: 5 }),
    SMTP_MAX_MESSAGES: Type.Number({ default: 100 }),
    SMTP_CONNECTION_TIMEOUT: Type.Number({ default: 2 * 60 * 1000 }),
    SMTP_SOCKET_TIMEOUT: Type.Number({ default: 10 * 60 * 1000 }),
    SMTP_TLS_REJECT_UNAUTHORIZED: Type.Boolean({ default: true }),
    SMTP_USER: Type.Optional(Type.String()),
    SMTP_PASS: Type.Optional(Type.String()),

    MAILER_DEFAULT_FROM: Type.String({ default: "Starter <no-reply@example.com>" }),
    MAILER_DEFAULT_SUBJECT: Type.String({ default: "Starter Notification" }),
    MAILER_DEFAULT_REPLY_TO: Type.Optional(Type.String()),
    MAILER_DEFAULT_PRIORITY: Type.Union([Type.Literal("high"), Type.Literal("normal"), Type.Literal("low")], {
        default: "normal",
    }),

    JWT_PRIVATE_KEY: Type.Optional(Type.String()),
    JWT_PUBLIC_KEY: Type.Optional(Type.String()),
    AUTH_ACCESS_TOKEN_TTL: Type.Number({ default: 600 }),
    AUTH_REFRESH_TOKEN_TTL: Type.Number({ default: 6 * 60 * 60 }),
    AUTH_REFRESH_COOKIE_NAME: Type.String({ default: "starter_refresh" }),

    OPENAPI_USER: Type.String({ default: "root" }),
    OPENAPI_PASS: Type.String({ default: "root" }),

    SEED_ADMIN_EMAIL: Type.String({ default: "admin@example.com" }),
    SEED_ADMIN_PASSWORD: Type.Optional(Type.String()),

    MAX_EVENT_LOOP_DELAY: Type.Number({ default: 1000 }),
    MAX_EVENT_LOOP_UTILIZATION: Type.Number({ default: 0.9 }),
    UNDER_PRESSURE_MESSAGE: Type.String({ default: "Server under pressure!" }),
    RETRY_AFTER: Type.Number({ default: 60 }),
})

const parseEnv = () => {
    const candidate = Value.Clean(EnvSchema, Value.Convert(EnvSchema, Value.Default(EnvSchema, { ...process.env })))

    if (!Value.Check(EnvSchema, candidate)) {
        const details = [...Value.Errors(EnvSchema, candidate)]
            .map((issue) => `  ${issue.instancePath.replace(/^\//, "") || "(root)"}: ${issue.message}`)
            .join("\n")
        throw new Error(`Invalid environment configuration:\n${details}`)
    }

    return candidate
}

export const env = parseEnv()

export const isDevEnvironment = env.NODE_ENV === "development"
export const isTestEnvironment = env.NODE_ENV === "test"
export const isProdEnvironment = env.NODE_ENV === "production"

/**
 * Return the variable's value, or a dev/test fallback. In production a
 * missing value is a hard boot failure — secrets must never silently
 * fall back outside local development.
 */
export const requireInProd = (name: keyof typeof env, fallback: string): string => {
    const value = env[name]
    if (typeof value === "string" && value.length > 0) {
        return value
    }
    if (isProdEnvironment) {
        throw new Error(`Missing required environment variable in production: ${String(name)}`)
    }
    return fallback
}

export const decodeBase64 = (value: string | undefined): string | undefined =>
    value ? Buffer.from(value, "base64").toString("utf8") : undefined

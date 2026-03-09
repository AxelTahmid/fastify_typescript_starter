import "dotenv/config"
import type { FastifyCorsOptions } from "@fastify/cors"
import type { FastifyMultipartBaseOptions } from "@fastify/multipart"
import type { SwaggerOptions } from "@fastify/swagger"
import type { FastifyUnderPressureOptions } from "@fastify/under-pressure"
import type { FastifyInstance } from "fastify"
import type { ClientOptions } from "minio"
import type { SendMailOptions, TransportOptions } from "nodemailer"
import type { PoolConfig } from "pg"
import type { ConstructorOptions } from "pg-boss"

interface StorageConfig {
    multer: FastifyMultipartBaseOptions["limits"]
    connection: ClientOptions
    publicBaseUrl: string
    bucket?: string
}

interface MailerConfig {
    defaults: Partial<SendMailOptions>
    transport: TransportOptions
}

interface AuthConfig {
    accessTokenExpiresInSeconds: number
    privateKeyBase64: string
    publicKeyBase64: string
}

interface OpenApiAuthConfig {
    user: string
    pass: string
}

interface AppConfig {
    host: string
    port: number
    serverTlsCert?: string
    serverTlsKey?: string
    isDevEnvironment: boolean
    keepAliveTimeout: number
    requestTimeout: number
    bodyLimit: number
    auth: AuthConfig
    cors: FastifyCorsOptions
    csp: {
        directives: {
            defaultSrc: string[]
            scriptSrc: string[]
            styleSrc: string[]
            fontSrc: string[]
            imgSrc: string[]
            connectSrc: string[]
            objectSrc: string[]
            mediaSrc: string[]
            frameSrc: string[]
        }
    }
    database: {
        pool: PoolConfig
        queue: ConstructorOptions & Record<string, unknown>
        timezone: string
    }
    storage: StorageConfig
    healthcheck: FastifyUnderPressureOptions
    mailer: MailerConfig
    swagger: SwaggerOptions
    captcha: {
        secret?: string
    }
    openapi: OpenApiAuthConfig
}

const dbUrl =
    process.env.PG_CONNECTION_STRING ||
    process.env.DB_CONNECTION_STRING ||
    process.env.DATABASE_URL ||
    `postgres://${process.env.DB_USER || "starteruser"}:${process.env.DB_PASSWORD || "starterpass"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || "starterdb"}`

const parseNumber = (value: string | undefined, defaultValue: number): number => {
    if (value === undefined || value === null || value.trim().length === 0) {
        return defaultValue
    }

    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isNaN(parsed) ? defaultValue : parsed
}

const parseDecimal = (value: string | undefined, defaultValue: number): number => {
    if (value === undefined || value === null || value.trim().length === 0) {
        return defaultValue
    }

    const parsed = Number.parseFloat(value.trim())
    return Number.isNaN(parsed) ? defaultValue : parsed
}

const parseStorageConnection = (value: string | undefined): Pick<StorageConfig, "connection" | "publicBaseUrl"> => {
    const rawEndpoint = value?.trim().length ? value.trim() : "http://localhost:9000"
    const normalizedEndpoint = rawEndpoint.includes("://") ? rawEndpoint : `http://${rawEndpoint}`
    const parsedEndpoint = new URL(normalizedEndpoint)
    const useSSL = parsedEndpoint.protocol === "https:"
    const port = parsedEndpoint.port ? Number(parsedEndpoint.port) : useSSL ? 443 : 80

    return {
        connection: {
            endPoint: parsedEndpoint.hostname,
            port,
            useSSL,
            region: process.env.S3_REGION || "us-east-1",
            accessKey: process.env.S3_ACCESS_KEY || "",
            secretKey: process.env.S3_SECRET_PASSWORD || "",
            pathStyle: true,
        },
        publicBaseUrl: `${useSSL ? "https" : "http"}://${parsedEndpoint.hostname}${parsedEndpoint.port ? `:${parsedEndpoint.port}` : ""}`,
    }
}

const storageConnection = parseStorageConnection(process.env.S3_ENDPOINT)

const config: AppConfig = {
    host: process.env.HOST || "0.0.0.0",
    port: parseNumber(process.env.PORT, 3000),
    isDevEnvironment: process.env.NODE_ENV === "development",
    serverTlsCert: process.env.SERVER_TLS_CERT
        ? Buffer.from(process.env.SERVER_TLS_CERT, "base64").toString("utf8")
        : undefined,
    serverTlsKey: process.env.SERVER_TLS_KEY
        ? Buffer.from(process.env.SERVER_TLS_KEY, "base64").toString("utf8")
        : undefined,
    keepAliveTimeout: parseNumber(process.env.SERVER_KEEP_ALIVE_TIMEOUT, 60000),
    requestTimeout: parseNumber(process.env.SERVER_REQUEST_TIMEOUT, 30000),
    bodyLimit: parseNumber(process.env.SERVER_BODY_LIMIT, 5 * 1024 * 1024),
    auth: {
        accessTokenExpiresInSeconds: parseNumber(process.env.ADMIN_ACCESS_TOKEN_EXPIRES_SECONDS, 24 * 60 * 60),
        privateKeyBase64: process.env.JWT_PRIVATE_KEY || "",
        publicKeyBase64: process.env.JWT_PUBLIC_KEY || "",
    },
    cors: {
        origin: [],
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Origin",
            "User-Agent",
            "X-Requested-With",
            "If-Modified-Since",
            "Cache-Control",
            "Range",
        ],
        credentials: true,
    },
    csp: {
        directives: {
            defaultSrc: ["'none'"],
            scriptSrc: ["'none'"],
            styleSrc: ["'none'"],
            fontSrc: ["'none'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
    database: {
        pool: {
            application_name: process.env.DB_APP_NAME || "fastify-starter",
            connectionString: dbUrl,
            min: parseNumber(process.env.DB_POOL_MIN, 1),
            max: parseNumber(process.env.DB_POOL_MAX, 10),
            idleTimeoutMillis: parseNumber(process.env.DB_POOL_IDLE_TIMEOUT, 10000),
            connectionTimeoutMillis: parseNumber(process.env.DB_POOL_CONNECTION_TIMEOUT, 5000),
            query_timeout: parseNumber(process.env.DB_QUERY_TIMEOUT, 30000),
            lock_timeout: parseNumber(process.env.DB_LOCK_TIMEOUT, 5000),
            statement_timeout: parseNumber(process.env.DB_STATEMENT_TIMEOUT, 30000),
            keepAliveInitialDelayMillis: parseNumber(process.env.DB_KEEP_ALIVE_INITIAL_DELAY, 30000),
            idle_in_transaction_session_timeout: parseNumber(process.env.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT, 30000),
        },
        queue: {
            connectionString: dbUrl,
            application_name: process.env.PGBOSS_APP_NAME || "fastify-starter-queue",
            schema: process.env.PGBOSS_SCHEMA || "queue",
            migrate: process.env.PGBOSS_MIGRATE !== "false",
            max: parseNumber(process.env.PGBOSS_MAX_CONN, 5),
            archiveCompletedAfterSeconds: parseNumber(process.env.PGBOSS_ARCHIVE_COMPLETED_AFTER, 60 * 60 * 12),
            archiveFailedAfterSeconds: parseNumber(process.env.PGBOSS_ARCHIVE_FAILED_AFTER, 60 * 60 * 12),
            deleteAfterDays: parseNumber(process.env.PGBOSS_DELETE_AFTER_DAYS, 7),
            monitorStateIntervalMinutes: parseNumber(process.env.PGBOSS_MONITOR_INTERVAL, 5),
        } as ConstructorOptions & Record<string, unknown>,
        timezone: process.env.DB_TIMEZONE || "UTC",
    },
    storage: {
        multer: {
            fieldNameSize: 100,
            fieldSize: 100,
            fields: 2,
            fileSize: 1_000_000,
            files: 1,
        },
        connection: storageConnection.connection,
        publicBaseUrl: storageConnection.publicBaseUrl,
        bucket: process.env.S3_BUCKET,
    },
    healthcheck: {
        maxEventLoopDelay: parseNumber(process.env.MAX_EVENT_LOOP_DELAY, 1000),
        maxEventLoopUtilization: parseDecimal(process.env.MAX_EVENT_LOOP_UTILIZATION, 0.9),
        message: process.env.UNDER_PRESSURE_MESSAGE || "Server under pressure!",
        retryAfter: parseNumber(process.env.RETRY_AFTER, 60),
        exposeStatusRoute: {
            routeOpts: {},
            routeResponseSchemaOpts: {
                metrics: {
                    type: "object",
                    properties: {
                        eventLoopDelay: { type: "number" },
                        eventLoopUtilized: { type: "number" },
                        rssBytes: { type: "number" },
                        heapUsed: { type: "number" },
                    },
                },
            },
        },
        healthCheck: async (app: FastifyInstance) => ({
            metrics: app.memoryUsage(),
        }),
    },
    mailer: {
        defaults: {
            from: process.env.MAILER_DEFAULT_FROM || "Starter <no-reply@example.com>",
            subject: process.env.MAILER_DEFAULT_SUBJECT || "Starter Notification",
            replyTo: process.env.MAILER_DEFAULT_REPLY_TO,
            priority: (process.env.MAILER_DEFAULT_PRIORITY as "high" | "normal" | "low") || "normal",
        },
        transport: {
            host: process.env.SMTP_HOST || "localhost",
            port: parseNumber(process.env.SMTP_PORT, 1025),
            secure: process.env.SMTP_SECURE === "true",
            pool: process.env.SMTP_POOL === "true",
            maxConnections: parseNumber(process.env.SMTP_MAX_CONNECTIONS, 5),
            maxMessages: parseNumber(process.env.SMTP_MAX_MESSAGES, 100),
            connectionTimeout: parseNumber(process.env.SMTP_CONNECTION_TIMEOUT, 2 * 60 * 1000),
            socketTimeout: parseNumber(process.env.SMTP_SOCKET_TIMEOUT, 10 * 60 * 1000),
            auth:
                process.env.SMTP_USER && process.env.SMTP_PASS
                    ? {
                          user: process.env.SMTP_USER,
                          pass: process.env.SMTP_PASS,
                      }
                    : undefined,
            tls: {
                rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
            },
        } as TransportOptions,
    },
    swagger: {
        openapi: {
            openapi: "3.1.0",
            info: {
                title: "Fastify TypeScript Starter API",
                description: "API documentation for the starter backend",
                version: "2.0.0",
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Development server",
                },
            ],
            security: [{ bearerAuth: [] }],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT",
                        description: "Enter JWT Bearer token only",
                    },
                },
            },
        },
        refResolver: {
            buildLocalReference(json, _baseUri, fragment, i) {
                if (typeof json.$id === "string") return json.$id
                if (typeof json.title === "string") return json.title
                if (fragment) {
                    const name = fragment.split("/").pop()
                    if (name && name !== "properties" && name !== "items") {
                        return `${name}${i}`
                    }
                }
                return `AutoSchema${i}`
            },
        },
    },
    captcha: {
        secret: process.env.TURNSTILE_SECRET_KEY,
    },
    openapi: {
        user: process.env.OPENAPI_USER || "root",
        pass: process.env.OPENAPI_PASS || "root",
    },
}

export default config as Readonly<AppConfig>

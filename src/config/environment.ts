import type { FastifyCorsOptions } from "@fastify/cors"
import type { FastifyMultipartBaseOptions } from "@fastify/multipart"
import type { SwaggerOptions } from "@fastify/swagger"
import type { FastifyUnderPressureOptions } from "@fastify/under-pressure"
import type { FastifyInstance } from "fastify"
import type { ClientOptions } from "minio"
import type { SendMailOptions, TransportOptions } from "nodemailer"
import type { PoolConfig } from "pg"
import type { ConstructorOptions } from "pg-boss"
import { decodeBase64, env, isDevEnvironment, isProdEnvironment, isTestEnvironment, requireInProd } from "./env.js"

interface StorageConfig {
    multer: FastifyMultipartBaseOptions["limits"]
    connection: ClientOptions
    /** Endpoint the app uses to reach object storage (container-internal). */
    internalEndpoint: string
    /** Endpoint browsers use — presigned URL hosts are rewritten to this. */
    publicEndpoint: string
    bucket: string
}

interface MailerConfig {
    defaults: Partial<SendMailOptions>
    transport: TransportOptions
}

interface AuthConfig {
    accessTokenTtlSeconds: number
    refreshTokenTtlSeconds: number
    refreshCookieName: string
    privateKeyBase64: string
    publicKeyBase64: string
}

interface OpenApiAuthConfig {
    user: string
    pass: string
}

interface SeedConfig {
    adminEmail: string
    adminPassword: string
}

interface AppConfig {
    host: string
    port: number
    serverTlsCert?: string
    serverTlsKey?: string
    isDevEnvironment: boolean
    isTestEnvironment: boolean
    isProdEnvironment: boolean
    keepAliveTimeout: number
    requestTimeout: number
    bodyLimit: number
    logRedactPaths: string[]
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
    openapi: OpenApiAuthConfig
    seed: SeedConfig
}

const dbUrl =
    env.PG_CONNECTION_STRING ||
    env.DB_CONNECTION_STRING ||
    env.DATABASE_URL ||
    `postgres://${env.DB_USER}:${requireInProd("DB_PASSWORD", "starterpass")}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`

const parseStorageConnection = (): Pick<StorageConfig, "connection" | "internalEndpoint" | "publicEndpoint"> => {
    const rawEndpoint = env.S3_ENDPOINT.trim()
    const normalizedEndpoint = rawEndpoint.includes("://") ? rawEndpoint : `http://${rawEndpoint}`
    const parsedEndpoint = new URL(normalizedEndpoint)
    const useSSL = parsedEndpoint.protocol === "https:"
    const port = parsedEndpoint.port ? Number(parsedEndpoint.port) : useSSL ? 443 : 80
    const internalEndpoint = `${useSSL ? "https" : "http"}://${parsedEndpoint.hostname}${
        parsedEndpoint.port ? `:${parsedEndpoint.port}` : ""
    }`

    return {
        connection: {
            endPoint: parsedEndpoint.hostname,
            port,
            useSSL,
            region: env.S3_REGION,
            accessKey: requireInProd("S3_ACCESS_KEY", "minioadmin"),
            secretKey: requireInProd("S3_SECRET_PASSWORD", "minioadmin"),
            pathStyle: true,
        },
        internalEndpoint,
        publicEndpoint: env.S3_PUBLIC_ENDPOINT?.trim() || internalEndpoint,
    }
}

const storageConnection = parseStorageConnection()

const config: AppConfig = {
    host: env.HOST,
    port: env.PORT,
    isDevEnvironment,
    isTestEnvironment,
    isProdEnvironment,
    serverTlsCert: decodeBase64(env.SERVER_TLS_CERT),
    serverTlsKey: decodeBase64(env.SERVER_TLS_KEY),
    keepAliveTimeout: env.SERVER_KEEP_ALIVE_TIMEOUT,
    requestTimeout: env.SERVER_REQUEST_TIMEOUT,
    bodyLimit: env.SERVER_BODY_LIMIT,
    logRedactPaths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "*.password",
        "*.newPassword",
        "*.token",
        "*.accessToken",
        "*.refreshToken",
        "*.secret",
        "*.secretKey",
        "*.apiKey",
    ],
    auth: {
        accessTokenTtlSeconds: env.AUTH_ACCESS_TOKEN_TTL,
        refreshTokenTtlSeconds: env.AUTH_REFRESH_TOKEN_TTL,
        refreshCookieName: env.AUTH_REFRESH_COOKIE_NAME,
        privateKeyBase64: env.JWT_PRIVATE_KEY || "",
        publicKeyBase64: env.JWT_PUBLIC_KEY || "",
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
            application_name: env.DB_APP_NAME,
            connectionString: dbUrl,
            min: env.DB_POOL_MIN,
            max: env.DB_POOL_MAX,
            idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT,
            connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT,
            query_timeout: env.DB_QUERY_TIMEOUT,
            lock_timeout: env.DB_LOCK_TIMEOUT,
            statement_timeout: env.DB_STATEMENT_TIMEOUT,
            keepAliveInitialDelayMillis: env.DB_KEEP_ALIVE_INITIAL_DELAY,
            idle_in_transaction_session_timeout: env.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT,
        },
        queue: {
            connectionString: dbUrl,
            application_name: env.PGBOSS_APP_NAME,
            schema: env.PGBOSS_SCHEMA,
            migrate: env.PGBOSS_MIGRATE,
            max: env.PGBOSS_MAX_CONN,
            archiveCompletedAfterSeconds: env.PGBOSS_ARCHIVE_COMPLETED_AFTER,
            archiveFailedAfterSeconds: env.PGBOSS_ARCHIVE_FAILED_AFTER,
            deleteAfterDays: env.PGBOSS_DELETE_AFTER_DAYS,
            monitorStateIntervalMinutes: env.PGBOSS_MONITOR_INTERVAL,
        } as ConstructorOptions & Record<string, unknown>,
        timezone: env.DB_TIMEZONE,
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
        internalEndpoint: storageConnection.internalEndpoint,
        publicEndpoint: storageConnection.publicEndpoint,
        bucket: env.S3_BUCKET,
    },
    healthcheck: {
        maxEventLoopDelay: env.MAX_EVENT_LOOP_DELAY,
        maxEventLoopUtilization: env.MAX_EVENT_LOOP_UTILIZATION,
        message: env.UNDER_PRESSURE_MESSAGE,
        retryAfter: env.RETRY_AFTER,
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
            from: env.MAILER_DEFAULT_FROM,
            subject: env.MAILER_DEFAULT_SUBJECT,
            replyTo: env.MAILER_DEFAULT_REPLY_TO,
            priority: env.MAILER_DEFAULT_PRIORITY,
        },
        transport: {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            pool: env.SMTP_POOL,
            maxConnections: env.SMTP_MAX_CONNECTIONS,
            maxMessages: env.SMTP_MAX_MESSAGES,
            connectionTimeout: env.SMTP_CONNECTION_TIMEOUT,
            socketTimeout: env.SMTP_SOCKET_TIMEOUT,
            auth:
                env.SMTP_USER && env.SMTP_PASS
                    ? {
                          user: env.SMTP_USER,
                          pass: env.SMTP_PASS,
                      }
                    : undefined,
            tls: {
                rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED,
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
                    url: `http://localhost:${env.PORT}`,
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
    openapi: {
        user: env.OPENAPI_USER,
        pass: env.OPENAPI_PASS,
    },
    seed: {
        adminEmail: env.SEED_ADMIN_EMAIL,
        adminPassword: requireInProd("SEED_ADMIN_PASSWORD", "changeme-admin-password"),
    },
}

export default config as Readonly<AppConfig>

import { pathToFileURL } from "node:url"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import closeWithGrace from "close-with-grace"
import fastify from "fastify"

import conf from "#config/environment.js"
import cache from "#plugins/cache.js"
import db from "#plugins/db.js"
import inputGuard from "#plugins/input-guard.js"
import jwt from "#plugins/jwt.js"
import nodemailer from "#plugins/nodemailer.js"
import pgboss from "#plugins/pgboss.js"
import schemas from "#plugins/schemas.js"
import storage from "#plugins/storage.js"
import routes from "./routes.js"

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error)
    process.exit(1)
})

process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error)
    process.exit(1)
})

process.setMaxListeners(20)

const devLogger = {
    target: "pino-pretty",
    options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
    },
} as const

export const createServer = async () => {
    const enableHTTP2 = !!(conf.serverTlsCert && conf.serverTlsKey)

    const app = fastify({
        trustProxy: true,
        ...(enableHTTP2 === true && {
            http2: true,
            https: { allowHTTP1: true, cert: conf.serverTlsCert, key: conf.serverTlsKey },
        }),
        requestTimeout: conf.requestTimeout,
        keepAliveTimeout: conf.keepAliveTimeout,
        bodyLimit: conf.bodyLimit,
        logger: {
            transport: conf.isDevEnvironment ? devLogger : undefined,
            redact: {
                paths: conf.logRedactPaths,
                censor: "[redacted]",
            },
        },
        disableRequestLogging: conf.isTestEnvironment,
    }).withTypeProvider<TypeBoxTypeProvider>()

    if (conf.isDevEnvironment && Array.isArray(conf.cors.origin)) {
        conf.cors.origin.push(/^https?:\/\/localhost(:\d{1,5})?$/)
        conf.cors.origin.push(/^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.app$/)
        conf.cors.origin.push(/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/)
    }

    // 4xx keep their message (clients need it); 5xx are logged in full and
    // genericized so internals never leak, with the request id echoed back
    // for log correlation.
    app.setErrorHandler((error, request, reply) => {
        const statusCode = error.statusCode ?? (reply.statusCode >= 400 ? reply.statusCode : 500)

        if (statusCode < 500) {
            reply.code(statusCode).send({
                error: true,
                statusCode,
                message: error.message,
            })
            return
        }

        request.log.error({ err: error, reqId: request.id }, "Unhandled server error")
        reply.code(statusCode).send({
            error: true,
            statusCode,
            message: "Internal Server Error",
            requestId: request.id,
        })
    })

    /**
     * Plugin registration order is a topological sort of the decorator
     * dependency graph — fastify-plugin enforces it via each plugin's
     * `dependencies`, so a wrong order fails at boot, not at runtime:
     *
     *   security/parsers: helmet → cors → formbody → sensible → cookie
     *   observability:    under-pressure (+ dev: swagger/scalar)
     *   schemas:          shared $id registry (must precede routes)
     *   data:             db → cache → jwt (denylist needs cache)
     *   services:         input-guard → storage → pgboss → mailer
     *   routes:           last
     */
    await app
        .register(import("@fastify/helmet"), {
            global: true,
            contentSecurityPolicy: {
                directives: conf.csp.directives,
            },
        })
        .register(import("@fastify/cors"), conf.cors)
        .register(import("@fastify/formbody"))
        .register(import("@fastify/sensible"))
        .register(import("@fastify/cookie"))
        .register(import("@fastify/under-pressure"), conf.healthcheck)

    if (conf.isDevEnvironment) {
        await app.register(import("@fastify/swagger"), conf.swagger).register(import("@fastify/basic-auth"), {
            validate: async (username, password) => {
                if (username !== conf.openapi.user || password !== conf.openapi.pass) {
                    throw new Error("Unauthorized")
                }
            },
            authenticate: { realm: "OpenAPI Documentation" },
        })

        await app.register(async (scope) => {
            scope.addHook("onRequest", scope.basicAuth)
            scope.get("/openapi.json", async (_req, reply) => reply.send(scope.swagger()))
            await scope.register(import("@scalar/fastify-api-reference"), {
                routePrefix: "/openapi",
            })
        })
    }

    await app.register(schemas)
    await app.register(db, conf.database.pool)
    await app.register(cache)
    await app.register(jwt)
    await app.register(inputGuard)
    await app.register(storage)
    await app.register(pgboss, conf.database.queue)
    await app.register(nodemailer, conf.mailer)
    await app.register(routes)

    const closeListeners = closeWithGrace({ delay: 2000 }, async ({ signal, err }) => {
        app.log.info("Graceful shutdown initiated")
        if (err) {
            app.log.error(err)
        } else {
            app.log.info(`${signal} received, shutting down server`)
        }
        await app.close()
    })

    app.addHook("onClose", async () => {
        closeListeners.uninstall()
        app.log.info("Graceful shutdown completed")
    })

    await app.ready()
    return app
}

const startServer = async () => {
    try {
        const app = await createServer()
        await app.listen({
            host: conf.host,
            port: conf.port,
        })
        app.log.info(`Server is running at ${conf.host}:${conf.port}`)
        process.send?.("ready")
    } catch (error) {
        console.error("Failed to start server:", error)
        process.exit(1)
    }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
    await startServer()
}

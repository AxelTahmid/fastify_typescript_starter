import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import { Permission } from "#acl/index.js"
import QueueAdminHandler from "./handlers.js"
import { RouteSchema } from "./schema.js"

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
    const handler = new QueueAdminHandler(app)

    app.route({
        method: "GET",
        url: "/",
        onRequest: app.auth.can(Permission.QUEUE_READ),
        schema: RouteSchema.list,
        handler: handler.list,
    })

    app.route({
        method: "GET",
        url: "/:name",
        onRequest: app.auth.can(Permission.QUEUE_READ),
        schema: RouteSchema.detail,
        handler: handler.detail,
    })

    app.route({
        method: "GET",
        url: "/:name/jobs/:id",
        onRequest: app.auth.can(Permission.QUEUE_READ),
        schema: RouteSchema.job,
        handler: handler.job,
    })

    app.route({
        method: "POST",
        url: "/:name/jobs/:id/cancel",
        onRequest: app.auth.can(Permission.QUEUE_WRITE),
        schema: RouteSchema.cancelJob,
        handler: handler.cancelJob,
    })

    app.route({
        method: "POST",
        url: "/:name/jobs/:id/resume",
        onRequest: app.auth.can(Permission.QUEUE_WRITE),
        schema: RouteSchema.resumeJob,
        handler: handler.resumeJob,
    })

    app.route({
        method: "DELETE",
        url: "/:name/jobs",
        onRequest: app.auth.can(Permission.QUEUE_WRITE),
        schema: RouteSchema.purge,
        handler: handler.purge,
    })
}

export default routes

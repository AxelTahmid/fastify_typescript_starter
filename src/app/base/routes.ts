import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import BaseHandler from "./handlers.js"
import { RouteSchema } from "./schema.js"

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
    const baseHandler = new BaseHandler(app)

    app.route({
        method: "GET",
        url: "/",
        schema: RouteSchema.base,
        handler: baseHandler.base,
    })

    app.route({
        method: "POST",
        url: "/otp",
        onRequest: app.role.restricted,
        schema: RouteSchema.arrayofString,
        handler: baseHandler.otpKeys,
    })

    app.route({
        method: "POST",
        url: "/cache",
        onRequest: app.role.restricted,
        schema: RouteSchema.cacheData,
        handler: baseHandler.cacheData,
    })

    app.route({
        method: "POST",
        url: "/queue",
        onRequest: app.role.restricted,
        schema: RouteSchema.queueAction,
        handler: baseHandler.queueAction,
    })

    app.route({
        method: "POST",
        url: "/flush",
        onRequest: app.role.restricted,
        schema: RouteSchema.flushCache,
        handler: baseHandler.flushCache,
    })
}

export default routes

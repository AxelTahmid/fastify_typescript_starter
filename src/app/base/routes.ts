import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import { Permission } from "#acl/index.js"
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

    // cache introspection is debug tooling — full admins only
    app.route({
        method: "POST",
        url: "/otp",
        onRequest: app.auth.can(Permission.SYSTEM_ADMIN),
        schema: RouteSchema.arrayofString,
        handler: baseHandler.otpKeys,
    })

    app.route({
        method: "POST",
        url: "/cache",
        onRequest: app.auth.can(Permission.SYSTEM_ADMIN),
        schema: RouteSchema.cacheData,
        handler: baseHandler.cacheData,
    })

    app.route({
        method: "POST",
        url: "/flush",
        onRequest: app.auth.can(Permission.SYSTEM_ADMIN),
        schema: RouteSchema.flushCache,
        handler: baseHandler.flushCache,
    })
}

export default routes

import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import AuthHandler from "./handler.js"
import AuthRepository from "./repository.js"
import { RouteSchema } from "./schema.js"
import AuthService from "./service.js"

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
    const repo = new AuthRepository(app.db)
    const svc = new AuthService(app, repo)
    const authHandler = new AuthHandler(app, svc, repo)

    app.route({
        method: "POST",
        url: "/register",
        schema: RouteSchema.register,
        handler: authHandler.register,
    })

    app.route({
        method: "POST",
        url: "/login",
        schema: RouteSchema.login,
        handler: authHandler.login,
    })

    app.route({
        method: "POST",
        url: "/refresh",
        schema: RouteSchema.refresh,
        handler: authHandler.refresh,
    })

    app.route({
        method: "POST",
        url: "/logout",
        schema: RouteSchema.logout,
        handler: authHandler.logout,
    })

    app.route({
        method: "POST",
        url: "/logout-all",
        onRequest: app.authenticate,
        schema: RouteSchema.logoutAll,
        handler: authHandler.logoutAll,
    })

    app.route({
        method: "GET",
        url: "/me",
        onRequest: app.authenticate,
        schema: RouteSchema.me,
        handler: authHandler.me,
    })

    app.route({
        method: "POST",
        url: "/otp-code",
        schema: RouteSchema.requestOTP,
        handler: authHandler.requestOTP,
    })

    app.route({
        method: "POST",
        url: "/verify-email",
        onRequest: app.authenticate,
        schema: RouteSchema.verifyEmail,
        handler: authHandler.verifyEmail,
    })

    app.route({
        method: "POST",
        url: "/reset-password",
        schema: RouteSchema.resetPassword,
        handler: authHandler.resetPassword,
    })
}

export default routes

import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import authRoutes from "#app/auth/routes.js"
import rootRoutes from "#app/base/routes.js"
import galleryRoutes from "#app/gallery/routes.js"
import queueRoutes from "#app/queue/routes.js"

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.setNotFoundHandler((_request, reply) => {
        reply.code(404).send({ error: true, message: "404 - Route Not Found" })
    })

    await app.register(rootRoutes)
    await app.register(authRoutes, { prefix: "/v1/auth" })
    await app.register(galleryRoutes, { prefix: "/v1/gallery" })
    await app.register(queueRoutes, { prefix: "/v1/queue" })
}

export default routes

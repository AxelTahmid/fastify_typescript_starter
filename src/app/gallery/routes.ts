import conf from "#config/environment.js"
import fastifyMultipart from "@fastify/multipart"
import type { FastifyInstance, FastifyPluginAsync } from "fastify"

import s3object from "#plugins/s3object.js"
import GalleryHandler from "./handlers.js"
import { RouteSchema } from "./schema.js"

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
    await app.register(fastifyMultipart, { limits: conf.storage.multer })
    await app.register(s3object, conf.storage.connection)

    const galleryHandler = new GalleryHandler(app)

    app.route({
        method: "GET",
        url: "/",
        schema: RouteSchema.gallery,
        handler: galleryHandler.gallery,
    })

    app.route({
        method: "PUT",
        url: "/upload",
        onRequest: app.role.restricted,
        schema: RouteSchema.upload,
        handler: galleryHandler.upload,
    })

    app.route({
        method: "POST",
        url: "/flush",
        onRequest: app.role.restricted,
        schema: RouteSchema.flush,
        handler: galleryHandler.flush,
    })

    app.route({
        method: "DELETE",
        url: "/selected",
        onRequest: app.role.restricted,
        schema: RouteSchema.destroyMany,
        handler: galleryHandler.destroyMany,
    })

    app.route({
        method: "DELETE",
        url: "/",
        onRequest: app.role.restricted,
        schema: RouteSchema.destroy,
        handler: galleryHandler.destroy,
    })
}

export default routes

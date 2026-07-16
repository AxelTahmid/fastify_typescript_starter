import fastifyMultipart from "@fastify/multipart"
import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import { Permission } from "#acl/index.js"
import conf from "#config/environment.js"
import GalleryHandler from "./handlers.js"
import { RouteSchema } from "./schema.js"

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
    await app.register(fastifyMultipart, { limits: conf.storage.multer })

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
        onRequest: app.auth.can(Permission.GALLERY_WRITE),
        schema: RouteSchema.upload,
        handler: galleryHandler.upload,
    })

    app.route({
        method: "POST",
        url: "/upload-url",
        onRequest: app.auth.can(Permission.GALLERY_WRITE),
        schema: RouteSchema.presignedUpload,
        handler: galleryHandler.presignedUpload,
    })

    app.route({
        method: "POST",
        url: "/flush",
        onRequest: app.auth.can(Permission.GALLERY_WRITE),
        schema: RouteSchema.flush,
        handler: galleryHandler.flush,
    })

    app.route({
        method: "DELETE",
        url: "/selected",
        onRequest: app.auth.can(Permission.GALLERY_WRITE),
        schema: RouteSchema.destroyMany,
        handler: galleryHandler.destroyMany,
    })

    app.route({
        method: "DELETE",
        url: "/",
        onRequest: app.auth.can(Permission.GALLERY_WRITE),
        schema: RouteSchema.destroy,
        handler: galleryHandler.destroy,
    })
}

export default routes

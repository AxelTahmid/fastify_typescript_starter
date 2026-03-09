import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import conf from "#config/environment.js"
import type { DestroyMany, KeyQueryString } from "./types.js"

class GalleryHandler {
    constructor(private readonly fastify: FastifyInstance) {}

    public flush = async (_req: FastifyRequest, reply: FastifyReply) => {
        await this.fastify.cache.flush("gallery:list")

        reply.code(200)
        return {
            error: false,
            message: "Media cache removed",
        }
    }

    public gallery = async (_req: FastifyRequest, reply: FastifyReply) => {
        const key = "gallery:list"
        let data = await this.fastify.cache.get<any>(key)

        if (!data) {
            const contents: Array<{ Key?: string; LastModified?: string; Size?: number; Url?: string }> = []

            const stream = this.fastify.s3.listObjectsV2(conf.storage.bucket || "", "", true)
            data = await new Promise<{ Contents: Array<{ Key?: string; LastModified?: string; Size?: number; Url?: string }> }>(
                (resolve, reject) => {
                    stream.on("data", (object) => {
                        contents.push({
                            Key: object.name,
                            LastModified: object.lastModified?.toISOString(),
                            Size: object.size,
                            Url: `${conf.storage.publicBaseUrl}/${conf.storage.bucket}/${object.name}`,
                        })
                    })
                    stream.on("end", () => resolve({ Contents: contents }))
                    stream.on("error", reject)
                },
            )
            await this.fastify.cache.set(key, data)
        }

        reply.code(200)
        return {
            error: false,
            message: "Media list fetched",
            data,
        }
    }

    public upload = async (req: FastifyRequest<{ Querystring: KeyQueryString }>, reply: FastifyReply) => {
        const data = await req.file()
        const buffer = await data?.toBuffer()
        const allowedMimes = ["image/png", "image/jpg", "image/jpeg", "image/webp", "image/svg+xml"]

        if (!data || !buffer) {
            throw this.fastify.httpErrors.badRequest("File upload is required")
        }
        if (!allowedMimes.includes(data.mimetype)) {
            throw this.fastify.httpErrors.notAcceptable(`Type: ${data.mimetype} not allowed!`)
        }

        await this.fastify.s3.putObject(
            conf.storage.bucket || "",
            req.query.Key,
            buffer,
            buffer.length,
            {
                "Content-Type": data.mimetype,
                "Cache-Control": "public,max-age=2628000,s-maxage=2628000",
            },
        )
        await this.fastify.cache.flush("gallery:list")

        reply.code(201)
        return {
            error: false,
            message: "Media created",
        }
    }

    public destroy = async (req: FastifyRequest<{ Querystring: KeyQueryString }>, reply: FastifyReply) => {
        await this.fastify.s3.removeObject(conf.storage.bucket || "", req.query.Key)
        await this.fastify.cache.flush("gallery:list")

        reply.code(201)
        return {
            error: false,
            message: `Media: ${req.query.Key} deleted.`,
        }
    }

    public destroyMany = async (req: FastifyRequest<{ Body: DestroyMany }>, reply: FastifyReply) => {
        await this.fastify.s3.removeObjects(
            conf.storage.bucket || "",
            (req.body.Objects || []).map((item) => item.Key),
        )
        await this.fastify.cache.flush("gallery:list")

        reply.code(201)
        return {
            error: false,
            message: "Selected files deleted",
        }
    }
}

export default GalleryHandler

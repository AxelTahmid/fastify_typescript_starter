import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import type { DestroyMany, KeyQueryString, PresignedUploadBody } from "./types.js"

const CACHE_KEY = "gallery:list"
const ALLOWED_MIMES = ["image/png", "image/jpg", "image/jpeg", "image/webp", "image/svg+xml"]

interface GalleryObject {
    Key?: string
    LastModified?: string
    Size?: number
    Url?: string
}

class GalleryHandler {
    constructor(private readonly fastify: FastifyInstance) {}

    public flush = async (_req: FastifyRequest, reply: FastifyReply) => {
        await this.fastify.cache.flush(CACHE_KEY)

        reply.code(200)
        return {
            error: false,
            message: "Media cache removed",
        }
    }

    public gallery = async (_req: FastifyRequest, reply: FastifyReply) => {
        let data = await this.fastify.cache.get<{ Contents: GalleryObject[] }>(CACHE_KEY)

        if (!data) {
            const { client, bucket, publicUrl } = this.fastify.storage
            const contents: GalleryObject[] = []

            const stream = client.listObjectsV2(bucket, "", true)
            data = await new Promise<{ Contents: GalleryObject[] }>((resolve, reject) => {
                stream.on("data", (object) => {
                    contents.push({
                        Key: object.name,
                        LastModified: object.lastModified?.toISOString(),
                        Size: object.size,
                        Url: object.name ? publicUrl(object.name) : undefined,
                    })
                })
                stream.on("end", () => resolve({ Contents: contents }))
                stream.on("error", reject)
            })
            await this.fastify.cache.set(CACHE_KEY, data)
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

        if (!data || !buffer) {
            throw this.fastify.httpErrors.badRequest("File upload is required")
        }
        if (!ALLOWED_MIMES.includes(data.mimetype)) {
            throw this.fastify.httpErrors.notAcceptable(`Type: ${data.mimetype} not allowed!`)
        }

        const { client, bucket } = this.fastify.storage
        await client.putObject(bucket, req.query.Key, buffer, buffer.length, {
            "Content-Type": data.mimetype,
            "Cache-Control": "public,max-age=2628000,s-maxage=2628000",
        })
        await this.fastify.cache.flush(CACHE_KEY)

        reply.code(201)
        return {
            error: false,
            message: "Media created",
        }
    }

    public presignedUpload = async (req: FastifyRequest<{ Body: PresignedUploadBody }>, reply: FastifyReply) => {
        const presigned = await this.fastify.storage.presignedUpload(req.body.key, req.body.contentType)
        await this.fastify.cache.flush(CACHE_KEY)

        reply.code(201)
        return {
            error: false,
            message: "Upload the file with a POST of the given form data",
            data: presigned,
        }
    }

    public destroy = async (req: FastifyRequest<{ Querystring: KeyQueryString }>, reply: FastifyReply) => {
        const { client, bucket } = this.fastify.storage
        await client.removeObject(bucket, req.query.Key)
        await this.fastify.cache.flush(CACHE_KEY)

        reply.code(201)
        return {
            error: false,
            message: `Media: ${req.query.Key} deleted.`,
        }
    }

    public destroyMany = async (req: FastifyRequest<{ Body: DestroyMany }>, reply: FastifyReply) => {
        const { client, bucket } = this.fastify.storage
        await client.removeObjects(
            bucket,
            (req.body.Objects || []).map((item) => item.Key),
        )
        await this.fastify.cache.flush(CACHE_KEY)

        reply.code(201)
        return {
            error: false,
            message: "Selected files deleted",
        }
    }
}

export default GalleryHandler

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import type { CacheKeyBody } from "./types.js"

class BaseHandler {
    constructor(private readonly fastify: FastifyInstance) {}

    public base = async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.code(200)
        return {
            label: "Welcome to API",
            uptime: process.uptime(),
            version: process.version,
            status: this.fastify.memoryUsage(),
        }
    }

    public otpKeys = async (_request: FastifyRequest, reply: FastifyReply) => {
        const data = await this.fastify.cache.getPattern("otp:*")

        reply.code(200)
        return {
            error: false,
            message: data.length ? "All OTP keys in circulation" : "No OTP keys in circulation",
            data,
        }
    }

    public cacheData = async (request: FastifyRequest<{ Body: CacheKeyBody }>, reply: FastifyReply) => {
        const key = request.body.key
        const data = await this.fastify.cache.get(key)

        reply.code(200)
        return {
            error: false,
            message: `Data for cache key ${key}`,
            data,
        }
    }

    public flushCache = async (_request: FastifyRequest, reply: FastifyReply) => {
        await this.fastify.cache.flushPattern("*")

        reply.code(200)
        return {
            error: false,
            message: "Cache globally flushed",
        }
    }
}

export default BaseHandler

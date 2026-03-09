import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { JOB_NAMES } from "#queue/workers/index.js"
import type { QueueBody } from "./types.js"

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
        const data = await this.fastify.cache.get_pattern("otp:*")

        reply.code(200)
        return {
            error: false,
            message: data.length ? "All OTP keys in circulation" : "No OTP keys in circulation",
            data,
        }
    }

    public cacheData = async (request: FastifyRequest, reply: FastifyReply) => {
        const key = (request.body as { key: string }).key
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

    public queueAction = async (request: FastifyRequest<{ Body: QueueBody }>, reply: FastifyReply) => {
        switch (request.body.action) {
            case "drain":
                await this.fastify.queue.deleteQueuedJobs(JOB_NAMES.SEND_OTP_EMAIL)
                break
            case "clean":
                await this.fastify.queue.deleteStoredJobs(JOB_NAMES.SEND_OTP_EMAIL)
                break
            case "obliterate":
                await this.fastify.queue.deleteAllJobs(JOB_NAMES.SEND_OTP_EMAIL)
                break
        }

        reply.code(200)
        return {
            error: false,
            message: `Queue action ${request.body.action} performed successfully`,
        }
    }
}

export default BaseHandler

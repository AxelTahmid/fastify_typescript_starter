import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import type { QueueJobParams, QueueNameParam } from "./types.js"

class QueueAdminHandler {
    constructor(private readonly fastify: FastifyInstance) {}

    public list = async (_req: FastifyRequest, reply: FastifyReply) => {
        const queues = await this.fastify.queue.getQueues()

        reply.code(200)
        return {
            error: false,
            message: "Queues fetched",
            data: queues,
        }
    }

    public detail = async (req: FastifyRequest<{ Params: QueueNameParam }>, reply: FastifyReply) => {
        const queue = await this.fastify.queue.getQueue(req.params.name)
        if (!queue) {
            throw this.fastify.httpErrors.notFound(`Queue: ${req.params.name} not found`)
        }
        const queuedCount = await this.fastify.queue.getQueueSize(req.params.name)

        reply.code(200)
        return {
            error: false,
            message: "Queue fetched",
            data: { ...queue, queuedCount },
        }
    }

    public job = async (req: FastifyRequest<{ Params: QueueJobParams }>, reply: FastifyReply) => {
        const job = await this.fastify.queue.getJobStatus(req.params.name, req.params.id)
        if (!job) {
            throw this.fastify.httpErrors.notFound(`Job: ${req.params.id} not found in ${req.params.name}`)
        }

        reply.code(200)
        return {
            error: false,
            message: "Job fetched",
            data: job,
        }
    }

    public cancelJob = async (req: FastifyRequest<{ Params: QueueJobParams }>, reply: FastifyReply) => {
        await this.fastify.queue.cancelJob(req.params.name, req.params.id)

        reply.code(200)
        return {
            error: false,
            message: `Job: ${req.params.id} cancelled`,
        }
    }

    public resumeJob = async (req: FastifyRequest<{ Params: QueueJobParams }>, reply: FastifyReply) => {
        await this.fastify.queue.resumeJob(req.params.name, req.params.id)

        reply.code(200)
        return {
            error: false,
            message: `Job: ${req.params.id} resumed`,
        }
    }

    public purge = async (req: FastifyRequest<{ Params: QueueNameParam }>, reply: FastifyReply) => {
        await this.fastify.queue.deleteQueuedJobs(req.params.name)

        reply.code(200)
        return {
            error: false,
            message: `Queued jobs deleted from: ${req.params.name}`,
        }
    }
}

export default QueueAdminHandler

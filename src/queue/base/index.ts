import type { FastifyInstance } from "fastify"
import type { JobWithMetadata, PgBoss, QueueResult, SendOptions } from "pg-boss"

export class QueueOperations {
    protected pgBoss: PgBoss
    protected app: FastifyInstance

    constructor(pgBoss: PgBoss, app: FastifyInstance) {
        this.pgBoss = pgBoss
        this.app = app
    }

    async getJobStatus(queue: string, jobId: string): Promise<JobWithMetadata<object> | null> {
        return this.pgBoss.getJobById(queue, jobId)
    }

    async getQueue(queueName: string): Promise<QueueResult | null> {
        return this.pgBoss.getQueue(queueName)
    }

    async getQueues(): Promise<QueueResult[]> {
        return this.pgBoss.getQueues()
    }

    async deleteQueuedJobs(queueName: string): Promise<void> {
        await this.pgBoss.deleteQueuedJobs(queueName)
    }

    async deleteStoredJobs(queueName: string): Promise<void> {
        await this.pgBoss.deleteStoredJobs(queueName)
    }

    async deleteAllJobs(queueName: string): Promise<void> {
        await this.pgBoss.deleteAllJobs(queueName)
    }

    async publishJob<T>(jobName: string, data: T, options?: SendOptions): Promise<string | null> {
        return this.pgBoss.send(jobName, data as object, options)
    }
}

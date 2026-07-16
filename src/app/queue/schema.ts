import type { FastifySchema } from "fastify"
import { Type } from "typebox"

export namespace Data {
    export const queueNameParam = Type.Object(
        {
            name: Type.String({ minLength: 1, maxLength: 128 }),
        },
        { $id: "QueueNameParam" },
    )

    export const queueJobParams = Type.Object(
        {
            name: Type.String({ minLength: 1, maxLength: 128 }),
            id: Type.String({ format: "uuid" }),
        },
        { $id: "QueueJobParams" },
    )
}

export const models = [Data.queueNameParam, Data.queueJobParams]

// Queue/job payloads come straight from pg-boss and vary by version —
// serialize them as-is instead of pinning a schema that could strip fields.
const replySchema = (withData = false) => ({
    type: "object",
    properties: {
        error: { type: "boolean" },
        message: { type: "string" },
        ...(withData ? { data: {} } : {}),
    },
    required: ["error", "message"],
})

export namespace RouteSchema {
    export const list: FastifySchema = {
        summary: "List queues",
        tags: ["queue"],
        response: { 200: replySchema(true) },
    }

    export const detail: FastifySchema = {
        summary: "Queue detail",
        description: "Queue configuration plus the number of jobs waiting",
        tags: ["queue"],
        params: Data.queueNameParam,
        response: { 200: replySchema(true) },
    }

    export const job: FastifySchema = {
        summary: "Job detail",
        tags: ["queue"],
        params: Data.queueJobParams,
        response: { 200: replySchema(true) },
    }

    export const cancelJob: FastifySchema = {
        summary: "Cancel a job",
        tags: ["queue"],
        params: Data.queueJobParams,
        response: { 200: replySchema() },
    }

    export const resumeJob: FastifySchema = {
        summary: "Resume a cancelled job",
        tags: ["queue"],
        params: Data.queueJobParams,
        response: { 200: replySchema() },
    }

    export const purge: FastifySchema = {
        summary: "Delete all queued jobs",
        description: "Removes jobs waiting in the queue; running/completed jobs are untouched",
        tags: ["queue"],
        params: Data.queueNameParam,
        response: { 200: replySchema() },
    }
}

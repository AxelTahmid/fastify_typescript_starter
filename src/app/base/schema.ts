import { Type } from "typebox"
import type { FastifySchema } from "fastify"

export namespace Data {
    export const baseResponse = Type.Object(
        {
            label: Type.Optional(Type.String()),
            uptime: Type.Optional(Type.Number()),
            version: Type.Optional(Type.String()),
            status: Type.Optional(
                Type.Object({
                    rssBytes: Type.Optional(Type.Number()),
                    heapUsed: Type.Optional(Type.Number()),
                    eventLoopDelay: Type.Optional(Type.Number()),
                    eventLoopUtilized: Type.Optional(Type.Number()),
                }),
            ),
        },
        { $id: "BaseResponse" },
    )

    export const queueBody = Type.Object(
        {
            action: Type.Union([Type.Literal("drain"), Type.Literal("clean"), Type.Literal("obliterate")]),
        },
        { $id: "QueueBody" },
    )

    export const cacheKeyBody = Type.Object(
        {
            key: Type.String(),
        },
        { $id: "CacheKeyBody" },
    )
}

export const models = [Data.baseResponse, Data.queueBody, Data.cacheKeyBody]

const replySchema = (data?: object) => ({
    type: "object",
    properties: {
        error: { type: "boolean" },
        message: { type: "string" },
        ...(data ? { data } : {}),
    },
    required: ["error", "message"],
})

export namespace RouteSchema {
    export const base: FastifySchema = {
        description: "Health status of application",
        tags: ["base"],
        response: { 200: { $ref: "BaseResponse#" } },
    }

    export const arrayofString: FastifySchema = {
        description: "Get OTP keys in circulation",
        tags: ["base"],
        response: { 200: replySchema({ type: "array", items: { type: "string" } }) },
    }

    export const cacheData: FastifySchema = {
        description: "Get cached value by key",
        tags: ["base"],
        body: Data.cacheKeyBody,
        response: { 200: replySchema() },
    }

    export const queueAction: FastifySchema = {
        description: "Perform queue maintenance action",
        tags: ["base"],
        body: Data.queueBody,
        response: { 200: replySchema() },
    }

    export const flushCache: FastifySchema = {
        description: "Flush cache entries",
        tags: ["base"],
        response: { 200: replySchema() },
    }
}

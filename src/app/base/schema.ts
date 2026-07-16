import type { FastifySchema } from "fastify"
import { Type } from "typebox"

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

    export const cacheKeyBody = Type.Object(
        {
            key: Type.String(),
        },
        { $id: "CacheKeyBody" },
    )
}

export const models = [Data.baseResponse, Data.cacheKeyBody]

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
        summary: "Health status",
        tags: ["base"],
        response: { 200: { $ref: "BaseResponse#" } },
    }

    export const arrayofString: FastifySchema = {
        summary: "Get OTP keys in circulation",
        tags: ["base"],
        response: { 200: replySchema({ type: "array", items: { type: "string" } }) },
    }

    export const cacheData: FastifySchema = {
        summary: "Get cached value by key",
        tags: ["base"],
        body: Data.cacheKeyBody,
        response: { 200: replySchema() },
    }

    export const flushCache: FastifySchema = {
        summary: "Flush cache entries",
        tags: ["base"],
        response: { 200: replySchema() },
    }
}

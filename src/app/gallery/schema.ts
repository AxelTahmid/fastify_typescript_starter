import { Type } from "typebox"
import type { FastifySchema } from "fastify"

export namespace Data {
    export const galleryContentObj = Type.Object(
        {
            Key: Type.Optional(Type.String()),
            LastModified: Type.Optional(Type.String()),
            Size: Type.Optional(Type.Number()),
            Url: Type.Optional(Type.String()),
        },
        { $id: "GalleryContent" },
    )

    export const galleryResponseObj = Type.Object(
        {
            Contents: Type.Optional(Type.Array(Data.galleryContentObj)),
        },
        { $id: "GalleryListResponse" },
    )

    export const keyQueryParam = Type.Object({ Key: Type.String() }, { $id: "GalleryKeyQuery" })

    export const destroyManyBody = Type.Object(
        {
            Objects: Type.Optional(Type.Array(Type.Object({ Key: Type.String() }))),
        },
        { $id: "GalleryDestroyMany" },
    )
}

export const models = [Data.galleryContentObj, Data.galleryResponseObj, Data.keyQueryParam, Data.destroyManyBody]

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
    export const gallery: FastifySchema = {
        description: "List gallery objects",
        tags: ["gallery"],
        response: { 200: replySchema({ $ref: "GalleryListResponse#" }) },
    }

    export const upload: FastifySchema = {
        description: "Upload a gallery object",
        tags: ["gallery"],
        querystring: Data.keyQueryParam,
        response: { 201: replySchema() },
    }

    export const destroy: FastifySchema = {
        description: "Delete a gallery object",
        tags: ["gallery"],
        querystring: Data.keyQueryParam,
        response: { 201: replySchema() },
    }

    export const destroyMany: FastifySchema = {
        description: "Delete multiple gallery objects",
        tags: ["gallery"],
        body: Data.destroyManyBody,
        response: { 201: replySchema() },
    }

    export const flush: FastifySchema = {
        description: "Flush gallery cache",
        tags: ["gallery"],
        response: { 200: replySchema() },
    }
}

import type { FastifySchema } from "fastify"
import { Type } from "typebox"

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
            Contents: Type.Optional(Type.Array(Type.Ref("GalleryContent"))),
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

    export const presignedUploadBody = Type.Object(
        {
            key: Type.String({ minLength: 1, maxLength: 512 }),
            contentType: Type.String({ pattern: "^image/(png|jpg|jpeg|webp|svg\\+xml)$" }),
        },
        { $id: "GalleryPresignedUploadBody" },
    )

    export const presignedUploadResponse = Type.Object(
        {
            postURL: Type.String(),
            formData: Type.Record(Type.String(), Type.String()),
            key: Type.String(),
        },
        { $id: "GalleryPresignedUpload" },
    )
}

export const models = [
    Data.galleryContentObj,
    Data.galleryResponseObj,
    Data.keyQueryParam,
    Data.destroyManyBody,
    Data.presignedUploadBody,
    Data.presignedUploadResponse,
]

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
        summary: "List gallery objects",
        tags: ["gallery"],
        response: { 200: replySchema({ $ref: "GalleryListResponse#" }) },
    }

    export const upload: FastifySchema = {
        summary: "Upload a gallery object",
        description: "Server-side multipart upload (small files)",
        tags: ["gallery"],
        querystring: Data.keyQueryParam,
        response: { 201: replySchema() },
    }

    export const presignedUpload: FastifySchema = {
        summary: "Create a presigned upload",
        description:
            "Returns a presigned POST policy so the browser uploads directly to object storage — the file never passes through the API",
        tags: ["gallery"],
        body: Data.presignedUploadBody,
        response: { 201: replySchema({ $ref: "GalleryPresignedUpload#" }) },
    }

    export const destroy: FastifySchema = {
        summary: "Delete a gallery object",
        tags: ["gallery"],
        querystring: Data.keyQueryParam,
        response: { 201: replySchema() },
    }

    export const destroyMany: FastifySchema = {
        summary: "Delete multiple gallery objects",
        tags: ["gallery"],
        body: Data.destroyManyBody,
        response: { 201: replySchema() },
    }

    export const flush: FastifySchema = {
        summary: "Flush gallery cache",
        tags: ["gallery"],
        response: { 200: replySchema() },
    }
}

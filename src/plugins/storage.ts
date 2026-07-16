import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"
import { Client } from "minio"
import conf from "#config/environment.js"

export interface PresignedUpload {
    /** POST target — host already rewritten to the public endpoint. */
    postURL: string
    /** Form fields the client must include with the file. */
    formData: Record<string, string>
    key: string
}

export interface StorageService {
    client: Client
    bucket: string
    publicEndpoint: string
    /** Public URL for an object (path-style). */
    publicUrl: (key: string) => string
    /**
     * Presigned POST policy for browser-direct uploads: bucket, key,
     * content type, and size range are pinned server-side; the returned
     * URL points at the public endpoint. The signature stays valid across
     * the host rewrite because the policy document, not the host, is signed.
     */
    presignedUpload: (
        key: string,
        contentType: string,
        maxSizeBytes?: number,
        expirySeconds?: number,
    ) => Promise<PresignedUpload>
    /** Presigned GET for temporary private downloads. */
    presignedDownload: (key: string, expirySeconds?: number) => Promise<string>
}

declare module "fastify" {
    interface FastifyInstance {
        storage: StorageService
    }
}

async function storage(fastify: FastifyInstance) {
    if (fastify.hasDecorator("storage")) {
        return
    }

    const client = new Client(conf.storage.connection)
    const bucket = conf.storage.bucket
    const publicEndpoint = conf.storage.publicEndpoint

    const rewriteHost = (url: string) => url.replace(/^https?:\/\/[^/]+/, publicEndpoint)

    const service: StorageService = {
        client,
        bucket,
        publicEndpoint,
        publicUrl: (key) => `${publicEndpoint}/${bucket}/${key}`,
        presignedUpload: async (key, contentType, maxSizeBytes = 5 * 1024 * 1024, expirySeconds = 600) => {
            const policy = client.newPostPolicy()
            policy.setBucket(bucket)
            policy.setKey(key)
            policy.setContentType(contentType)
            policy.setContentLengthRange(1, maxSizeBytes)
            policy.setExpires(new Date(Date.now() + expirySeconds * 1000))

            const { postURL, formData } = await client.presignedPostPolicy(policy)
            return { postURL: rewriteHost(postURL), formData, key }
        },
        presignedDownload: async (key, expirySeconds = 600) => {
            const url = await client.presignedGetObject(bucket, key, expirySeconds)
            return rewriteHost(url)
        },
    }

    fastify.decorate("storage", service)

    // Ensure the bucket exists once the server is up; never fail boot over
    // storage being down — routes will surface errors when actually used.
    fastify.addHook("onListen", async () => {
        try {
            const exists = await client.bucketExists(bucket)
            if (!exists) {
                await client.makeBucket(bucket, conf.storage.connection.region as string)
                fastify.log.info(`Storage bucket created: ${bucket}`)
            }
        } catch (error) {
            fastify.log.warn({ err: error }, `Storage unreachable — bucket "${bucket}" not verified`)
        }
    })
}

export default fp(storage, {
    fastify: ">=5.0.0",
    name: "storage",
})

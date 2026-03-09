import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"
import { Client, type ClientOptions } from "minio"

declare module "fastify" {
    interface FastifyInstance {
        s3: Client
    }
}

async function s3object(fastify: FastifyInstance, opts: ClientOptions) {
    if (fastify.hasDecorator("s3")) {
        return
    }

    const client = new Client(opts)
    fastify.decorate("s3", client)
}

export default fp(s3object, {
    fastify: ">=5.0.0",
    name: "s3object",
})

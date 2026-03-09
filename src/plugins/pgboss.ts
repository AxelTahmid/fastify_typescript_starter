import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"
import { type ConstructorOptions, PgBoss } from "pg-boss"
import { Queue } from "#queue/index.js"

declare module "fastify" {
    interface FastifyInstance {
        pgBoss: PgBoss
        queue: Queue
    }
}

async function fastifyPgBoss(app: FastifyInstance, opts: ConstructorOptions) {
    if (app.hasDecorator("pgBoss")) {
        return
    }

    const pgBoss = new PgBoss(opts)
    await pgBoss.start()

    const queue = new Queue(pgBoss, app)
    await queue.setupQueues()

    app.decorate("pgBoss", pgBoss)
    app.decorate("queue", queue)

    pgBoss.on("error", (err: Error) => {
        app.log.error({ err }, "pgBoss error")
    })

    app.addHook("onClose", async () => {
        await pgBoss.stop()
    })
}

export default fp(fastifyPgBoss, {
    fastify: ">=5.0.0",
    name: "pgboss",
})

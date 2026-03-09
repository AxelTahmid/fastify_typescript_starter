import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"
import { DeduplicateJoinsPlugin, Kysely, PostgresDialect, sql } from "kysely"
import { Pool, type PoolConfig } from "pg"
import conf from "#config/environment.js"
import type { DB } from "#database/db.d.js"
import { createDbHelpers, type DbHelpers, getDbHealth } from "#database/helpers.js"

declare module "fastify" {
    interface FastifyInstance {
        db: Kysely<DB> & DbHelpers
    }
}

async function fastifyDb(app: FastifyInstance, opts: PoolConfig) {
    if (app.hasDecorator("db")) {
        return
    }

    const pool = new Pool(opts)
    const db = new Kysely<DB>({
        dialect: new PostgresDialect({ pool }),
        plugins: [new DeduplicateJoinsPlugin()],
        log: conf.isDevEnvironment ? ["query", "error"] : ["error"],
    })

    try {
        const health = await getDbHealth(db)

        app.log.info(
            {
                version: health.version,
                uptime: health.uptime,
                connectionCount: health.connectionCount,
            },
            "Kysely database connection established",
        )

        await sql`SET TIME ZONE ${sql.raw(`'${conf.database.timezone}'`)};`.execute(db)

        const dbWithHelpers = db as Kysely<DB> & DbHelpers
        const helpers = createDbHelpers(db)
        dbWithHelpers.paginate = helpers.paginate
        dbWithHelpers.pgerr = helpers.pgerr
        dbWithHelpers.isPgError = helpers.isPgError
        dbWithHelpers.health = helpers.health

        app.decorate("db", dbWithHelpers)

        app.addHook("onClose", async (fastify) => {
            if (fastify.db === dbWithHelpers) {
                await db.destroy()
            }
        })
    } catch (error) {
        await db.destroy()
        throw error
    }
}

export default fp(fastifyDb, {
    fastify: ">=5.0.0",
    name: "db",
})

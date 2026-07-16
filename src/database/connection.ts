import { DeduplicateJoinsPlugin, Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"
import conf from "#config/environment.js"
import type { DB } from "./db.d.js"

/**
 * Standalone Kysely instance for CLI tools (migrations, seeds). The HTTP
 * server uses the db plugin instead, which layers helpers on top.
 */
export const createDatabase = (): Kysely<DB> =>
    new Kysely<DB>({
        dialect: new PostgresDialect({ pool: new Pool(conf.database.pool) }),
        plugins: [new DeduplicateJoinsPlugin()],
        log: ["error"],
    })

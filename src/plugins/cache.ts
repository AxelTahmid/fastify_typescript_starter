import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"
import { type Kysely, sql } from "kysely"
import type { DB, Json } from "#database/db.d.js"

declare module "fastify" {
    interface FastifyInstance {
        cache: CacheService
    }
}

async function fastifyCache(fastify: FastifyInstance) {
    if (!fastify.hasDecorator("cache")) {
        fastify.decorate("cache", new CacheService(fastify.db))
    }
}

export default fp(fastifyCache, {
    fastify: ">=5.0.0",
    name: "cache",
    dependencies: ["db"],
})

/**
 * Postgres-backed KV cache over the UNLOGGED `cache` table. Also provides
 * the atomic counter that backs rate limiting and the refresh-token
 * revocation denylist — one less moving part than Redis.
 */
export class CacheService {
    constructor(private readonly db: Kysely<DB>) {}

    async get<T = unknown>(key: string): Promise<T | null> {
        const item = await this.db
            .selectFrom("cache")
            .select(["value"])
            .where("key", "=", key)
            .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", sql<Date>`NOW()`)]))
            .executeTakeFirst()

        return item ? (item.value as T) : null
    }

    async set(key: string, data: unknown, ttlSeconds = 300): Promise<void> {
        const value = sql<Json>`${JSON.stringify(data)}::jsonb`
        const expiresAt = ttlSeconds ? sql<Date>`NOW() + make_interval(secs => ${ttlSeconds})` : null

        await this.db
            .insertInto("cache")
            .values({ key, value, expires_at: expiresAt })
            .onConflict((oc) =>
                oc.column("key").doUpdateSet({
                    value,
                    expires_at: expiresAt,
                    created_at: sql<Date>`NOW()`,
                }),
            )
            .execute()
    }

    /**
     * Atomically bump a fixed-window counter and return its current value.
     * First hit (or a hit after the window lapsed) restarts the window.
     * This is the primitive behind assertRateLimit().
     */
    async increment(key: string, windowSeconds: number): Promise<number> {
        const result = await sql<{ value: number }>`
            INSERT INTO cache (key, value, expires_at)
            VALUES (${key}, '1'::jsonb, NOW() + make_interval(secs => ${windowSeconds}))
            ON CONFLICT (key) DO UPDATE SET
                value = CASE
                    WHEN cache.expires_at IS NOT NULL AND cache.expires_at < NOW()
                    THEN '1'::jsonb
                    ELSE ((cache.value)::text::int + 1)::text::jsonb
                END,
                expires_at = CASE
                    WHEN cache.expires_at IS NOT NULL AND cache.expires_at < NOW()
                    THEN NOW() + make_interval(secs => ${windowSeconds})
                    ELSE cache.expires_at
                END,
                created_at = cache.created_at
            RETURNING (value)::text::int AS value
        `.execute(this.db)

        return Number(result.rows[0]?.value ?? 1)
    }

    async flush(keys: string | string[]): Promise<void> {
        const list = Array.isArray(keys) ? keys : [keys]
        await this.db.deleteFrom("cache").where("key", "in", list).execute()
    }

    async flushPattern(pattern: string): Promise<void> {
        await this.db.deleteFrom("cache").where("key", "like", pattern.replace(/\*/g, "%")).execute()
    }

    async getPattern(pattern: string): Promise<string[]> {
        const items = await this.db
            .selectFrom("cache")
            .select("key")
            .where("key", "like", pattern.replace(/\*/g, "%"))
            .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", sql<Date>`NOW()`)]))
            .execute()

        return items.map((item) => item.key)
    }

    /** Remove expired rows — wired to a scheduled queue job. */
    async pruneExpired(): Promise<number> {
        const result = await this.db
            .deleteFrom("cache")
            .where("expires_at", "is not", null)
            .where("expires_at", "<", sql<Date>`NOW()`)
            .executeTakeFirst()

        return Number(result?.numDeletedRows ?? 0n)
    }
}

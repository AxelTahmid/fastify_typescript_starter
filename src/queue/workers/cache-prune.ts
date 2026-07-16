import type { FastifyInstance } from "fastify"

/**
 * Hourly cron sweep (see Queue.setupQueues) — expired cache rows are
 * otherwise only skipped by reads, never removed.
 */
export const createCachePruneHandler = (app: FastifyInstance) => async () => {
    const removed = await app.cache.pruneExpired()
    if (removed > 0) {
        app.log.info({ removed }, "Pruned expired cache entries")
    }
}

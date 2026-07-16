import { createHash } from "node:crypto"
import type { FastifyInstance } from "fastify"

/**
 * Fixed-window rate limiting on the PG cache's atomic counter. Throws
 * 429 when the window's budget is exhausted. Key material (emails, IPs)
 * is hashed so raw identifiers never sit in the cache table.
 *
 *   await assertRateLimit(app, `login:${ip}`, 5, 300)
 */
export async function assertRateLimit(
    app: FastifyInstance,
    key: string,
    limit: number,
    windowSeconds: number,
): Promise<void> {
    const digest = createHash("sha256").update(key).digest("hex").slice(0, 32)
    const count = await app.cache.increment(`ratelimit:${digest}`, windowSeconds)

    if (count > limit) {
        throw app.httpErrors.tooManyRequests("Too many attempts, please try again later")
    }
}

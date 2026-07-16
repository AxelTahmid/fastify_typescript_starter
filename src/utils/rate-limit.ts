import { createHash } from "node:crypto"
import type { FastifyInstance } from "fastify"

/**
 * Fixed-window rate limiting on the PG cache's atomic counter. Throws
 * 429 when the window's budget is exhausted. Key material (emails, IPs)
 * is hashed so raw identifiers never sit in the cache table.
 *
 *   await assertRateLimit(app, `login:${ip}`, 5, 300)
 */
const digestFor = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 32)

export async function assertRateLimit(
    app: FastifyInstance,
    key: string,
    limit: number,
    windowSeconds: number,
): Promise<void> {
    const count = await app.cache.increment(`ratelimit:${digestFor(key)}`, windowSeconds)

    if (count > limit) {
        throw app.httpErrors.tooManyRequests("Too many attempts, please try again later")
    }
}

/** Reset a window early — e.g. a successful login clears its abuse budget. */
export async function clearRateLimit(app: FastifyInstance, key: string): Promise<void> {
    await app.cache.flush(`ratelimit:${digestFor(key)}`)
}

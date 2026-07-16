import type { FastifyInstance, FastifyRequest } from "fastify"
import fp from "fastify-plugin"

/**
 * Defense-in-depth for public write endpoints: rejects request bodies,
 * query strings, and params containing HTML/script-looking content before
 * validation runs. Schemas remain the primary defense — this hook stops
 * stored-XSS payloads in free-text fields that schemas can't constrain.
 */
const SUSPICIOUS_PATTERNS = [/[<>]/, /javascript\s*:/i, /\bon[a-z]+\s*=/i]

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"])

const containsSuspiciousContent = (value: unknown, seen = new Set<object>()): boolean => {
    if (typeof value === "string") {
        return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(value))
    }

    if (value && typeof value === "object") {
        if (seen.has(value)) {
            return false
        }
        seen.add(value)

        const values = Array.isArray(value) ? value : Object.values(value)
        return values.some((entry) => containsSuspiciousContent(entry, seen))
    }

    return false
}

async function inputGuard(app: FastifyInstance) {
    app.addHook("preValidation", async (req: FastifyRequest) => {
        if (!WRITE_METHODS.has(req.method)) {
            return
        }

        // multipart uploads are validated by their own handlers
        if (req.headers["content-type"]?.includes("multipart/form-data")) {
            return
        }

        if (
            containsSuspiciousContent(req.body) ||
            containsSuspiciousContent(req.query) ||
            containsSuspiciousContent(req.params)
        ) {
            throw app.httpErrors.badRequest("Request contains disallowed content")
        }
    })
}

export default fp(inputGuard, {
    fastify: ">=5.0.0",
    name: "input-guard",
    dependencies: ["@fastify/sensible"],
})

import { randomUUID } from "node:crypto"
import fastifyJwt from "@fastify/jwt"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import fp from "fastify-plugin"
import { can, canAny, type Permission } from "#acl/index.js"
import config from "#config/environment.js"

/**
 * Token model (billing-portal lineage):
 *  - access token: short-lived, carries the user's expanded permission
 *    slugs so authorization is a zero-DB-read check on the hot path
 *  - refresh token: identity-only + jti, delivered as an httpOnly cookie,
 *    revocable through a cache-table denylist (single logout via jti,
 *    logout-everywhere via a per-user iat watermark)
 */
export interface AccessTokenPayload {
    id: number
    email: string
    email_verified: boolean
    role: string
    permissions: Permission[]
    token_use: "access"
    iat?: number
}

export interface RefreshTokenPayload {
    id: number
    email: string
    jti: string
    token_use: "refresh"
    iat?: number
}

export interface TokenUser {
    id: number
    email: string
    email_verified: boolean
    role: string
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: AccessTokenPayload | RefreshTokenPayload
        user: AccessTokenPayload
    }
}

declare module "fastify" {
    interface FastifyInstance {
        authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
        auth: {
            /** onRequest hook factory: authenticate + default-deny permission gate. */
            can: (slug: Permission) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>
            /** onRequest hook factory: pass when the token holds ANY of the slugs. */
            any: (...slugs: Permission[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>
            /** onRequest hook: authenticate + require verified email. */
            verified: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
            issueTokenPair: (
                user: TokenUser,
                permissions: Permission[],
            ) => Promise<{ accessToken: string; refreshToken: string; refreshJti: string }>
            verifyRefreshToken: (token: string) => Promise<RefreshTokenPayload>
            revokeRefreshToken: (jti: string) => Promise<void>
            revokeAllForUser: (userId: number) => Promise<void>
        }
    }
}

const REVOKED_KEY = (jti: string) => `auth:revoked:${jti}`
const REVOKE_ALL_KEY = (userId: number) => `auth:revoke_all:${userId}`

async function fastJWT(app: FastifyInstance) {
    if (!config.auth.privateKeyBase64 || !config.auth.publicKeyBase64) {
        app.log.error("JWT keys are not set — generate them with: make jwt")
        process.exit(1)
    }

    let privateKey: string
    let publicKey: string
    try {
        privateKey = Buffer.from(config.auth.privateKeyBase64, "base64").toString("utf-8")
        publicKey = Buffer.from(config.auth.publicKeyBase64, "base64").toString("utf-8")
    } catch (error) {
        app.log.error({ err: error }, "Failed to decode base64 JWT keys")
        process.exit(1)
    }

    app.register(fastifyJwt, {
        secret: {
            private: privateKey,
            public: publicKey,
        },
        sign: { algorithm: "ES256" },
        verify: { algorithms: ["ES256"] },
    })

    const authenticate = async (req: FastifyRequest, _reply: FastifyReply) => {
        await req.jwtVerify()
        if (req.user.token_use !== "access") {
            throw app.httpErrors.unauthorized("Access token required")
        }
    }

    const verified = async (req: FastifyRequest, reply: FastifyReply) => {
        await authenticate(req, reply)
        if (!req.user.email_verified) {
            throw app.httpErrors.forbidden(`User: ${req.user.email} is not verified`)
        }
    }

    const gate =
        (check: (held: Permission[]) => boolean, describe: string) =>
        async (req: FastifyRequest, reply: FastifyReply) => {
            await authenticate(req, reply)
            const held = Array.isArray(req.user.permissions) ? req.user.permissions : []
            if (!check(held)) {
                throw app.httpErrors.forbidden(`Missing permission: ${describe}`)
            }
        }

    const issueTokenPair = async (user: TokenUser, permissions: Permission[]) => {
        const refreshJti = randomUUID()

        const accessToken = await app.jwt.sign(
            {
                id: user.id,
                email: user.email,
                email_verified: Boolean(user.email_verified),
                role: user.role,
                permissions,
                token_use: "access",
            },
            { expiresIn: config.auth.accessTokenTtlSeconds },
        )

        const refreshToken = await app.jwt.sign(
            {
                id: user.id,
                email: user.email,
                jti: refreshJti,
                token_use: "refresh",
            },
            { expiresIn: config.auth.refreshTokenTtlSeconds },
        )

        return { accessToken, refreshToken, refreshJti }
    }

    const verifyRefreshToken = async (token: string): Promise<RefreshTokenPayload> => {
        let payload: RefreshTokenPayload
        try {
            payload = app.jwt.verify<RefreshTokenPayload>(token)
        } catch {
            throw app.httpErrors.unauthorized("Invalid refresh token")
        }

        if (payload.token_use !== "refresh" || !payload.jti) {
            throw app.httpErrors.unauthorized("Invalid refresh token")
        }

        if (await app.cache.get(REVOKED_KEY(payload.jti))) {
            throw app.httpErrors.unauthorized("Refresh token has been revoked")
        }

        // iat is second-granular, so reject <= watermark: every token issued
        // at or before the revoke-all instant is dead (fail closed on ties)
        const watermark = await app.cache.get<number>(REVOKE_ALL_KEY(payload.id))
        if (watermark && payload.iat && payload.iat <= watermark) {
            throw app.httpErrors.unauthorized("Session has been revoked")
        }

        return payload
    }

    // Denylist entries only need to outlive the tokens they block.
    const revokeRefreshToken = async (jti: string) => {
        await app.cache.set(REVOKED_KEY(jti), true, config.auth.refreshTokenTtlSeconds)
    }

    const revokeAllForUser = async (userId: number) => {
        await app.cache.set(REVOKE_ALL_KEY(userId), Math.floor(Date.now() / 1000), config.auth.refreshTokenTtlSeconds)
    }

    app.decorate("authenticate", authenticate)
    app.decorate("auth", {
        can: (slug: Permission) => gate((held) => can(held, slug), slug),
        any: (...slugs: Permission[]) => gate((held) => canAny(held, ...slugs), slugs.join(" | ")),
        verified,
        issueTokenPair,
        verifyRefreshToken,
        revokeRefreshToken,
        revokeAllForUser,
    })
}

export default fp(fastJWT, {
    fastify: ">=5.0.0",
    name: "jwt",
    dependencies: ["cache", "@fastify/sensible"],
})

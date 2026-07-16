import type { FastifyReply } from "fastify"
import conf from "#config/environment.js"

/**
 * The refresh token travels ONLY as an httpOnly cookie scoped to the auth
 * routes — it is never in a response body, so script access and accidental
 * logging are off the table. SameSite=strict keeps it out of cross-site
 * requests entirely.
 */
const COOKIE_PATH = "/v1/auth"

export const setRefreshCookie = (reply: FastifyReply, token: string): void => {
    reply.setCookie(conf.auth.refreshCookieName, token, {
        httpOnly: true,
        sameSite: "strict",
        secure: conf.isProdEnvironment,
        path: COOKIE_PATH,
        maxAge: conf.auth.refreshTokenTtlSeconds,
    })
}

export const clearRefreshCookie = (reply: FastifyReply): void => {
    reply.clearCookie(conf.auth.refreshCookieName, { path: COOKIE_PATH })
}

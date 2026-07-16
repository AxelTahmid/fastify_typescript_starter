import conf from "#config/environment.js"
import { createServer } from "../server.js"

/**
 * Build the real Fastify app for integration tests. Requires a migrated,
 * seeded Postgres (CI provides one; locally run tests inside the compose
 * stack or point PG_CONNECTION_STRING at a dev database). Tests use
 * app.inject() — the server never listens, so MinIO/SMTP are not needed.
 */
export const buildApp = async () => {
    const app = await createServer()
    return app
}

export const uniqueEmail = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`

/** Login helper returning the access token and the refresh cookie. */
export const login = async (app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) => {
    const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email, password },
    })

    const body = response.json()
    const cookie = response.cookies.find((entry) => entry.name === conf.auth.refreshCookieName)

    return {
        statusCode: response.statusCode,
        token: body?.data?.token as string | undefined,
        refreshCookie: cookie?.value,
        body,
    }
}

export const seedAdminCredentials = () => ({
    email: conf.seed.adminEmail,
    password: conf.seed.adminPassword,
})

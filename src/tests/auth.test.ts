import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import conf from "#config/environment.js"
import { buildApp, login, uniqueEmail } from "./helper.js"

describe("auth flow", async () => {
    let app: Awaited<ReturnType<typeof buildApp>>
    const email = uniqueEmail("auth-flow")
    const password = "test-password-123"

    before(async () => {
        app = await buildApp()
    })

    after(async () => {
        await app.close()
    })

    it("registers a new user and returns an access token + refresh cookie", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/v1/auth/register",
            payload: { email, password },
        })

        assert.equal(response.statusCode, 201)
        const body = response.json()
        assert.equal(body.error, false)
        assert.ok(body.data.token, "access token missing")

        const cookie = response.cookies.find((entry) => entry.name === conf.auth.refreshCookieName)
        assert.ok(cookie, "refresh cookie missing")
        assert.equal(cookie.httpOnly, true)
        assert.equal(cookie.sameSite, "Strict")
    })

    it("rejects a duplicate registration with 409", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/v1/auth/register",
            payload: { email, password },
        })

        assert.equal(response.statusCode, 409)
    })

    it("rejects a wrong password with 401 and no cookie", async () => {
        const result = await login(app, email, "wrong-password-999")
        assert.equal(result.statusCode, 401)
        assert.equal(result.refreshCookie, undefined)
    })

    it("logs in and can fetch /me with the access token", async () => {
        const result = await login(app, email, password)
        assert.equal(result.statusCode, 200)
        assert.ok(result.token)
        assert.ok(result.refreshCookie)

        const me = await app.inject({
            method: "GET",
            url: "/v1/auth/me",
            headers: { authorization: `Bearer ${result.token}` },
        })

        assert.equal(me.statusCode, 200)
        const body = me.json()
        assert.equal(body.data.email, email)
        assert.equal(body.data.role, "customer")
        assert.equal(body.data.password, undefined, "password hash must never be serialized")
    })

    it("refuses /me with a refresh token (token_use check)", async () => {
        const result = await login(app, email, password)

        const me = await app.inject({
            method: "GET",
            url: "/v1/auth/me",
            headers: { authorization: `Bearer ${result.refreshCookie}` },
        })

        assert.equal(me.statusCode, 401)
    })

    it("rotates the session via the refresh cookie", async () => {
        const result = await login(app, email, password)

        const refreshed = await app.inject({
            method: "POST",
            url: "/v1/auth/refresh",
            cookies: { [conf.auth.refreshCookieName]: result.refreshCookie as string },
        })

        assert.equal(refreshed.statusCode, 200)
        assert.ok(refreshed.json().data.token)

        // the used refresh token was revoked by rotation
        const replayed = await app.inject({
            method: "POST",
            url: "/v1/auth/refresh",
            cookies: { [conf.auth.refreshCookieName]: result.refreshCookie as string },
        })

        assert.equal(replayed.statusCode, 401, "rotated refresh token must be rejected on replay")
    })

    it("refresh without a cookie is rejected", async () => {
        const response = await app.inject({ method: "POST", url: "/v1/auth/refresh" })
        assert.equal(response.statusCode, 401)
    })

    it("logout revokes the refresh token and clears the cookie", async () => {
        const result = await login(app, email, password)

        const logout = await app.inject({
            method: "POST",
            url: "/v1/auth/logout",
            cookies: { [conf.auth.refreshCookieName]: result.refreshCookie as string },
        })

        assert.equal(logout.statusCode, 200)
        const cleared = logout.cookies.find((entry) => entry.name === conf.auth.refreshCookieName)
        assert.ok(cleared, "clearing set-cookie missing")
        assert.equal(cleared.value, "")

        const replay = await app.inject({
            method: "POST",
            url: "/v1/auth/refresh",
            cookies: { [conf.auth.refreshCookieName]: result.refreshCookie as string },
        })

        assert.equal(replay.statusCode, 401)
    })

    it("logout-all revokes every session", async () => {
        const first = await login(app, email, password)
        const second = await login(app, email, password)

        const logoutAll = await app.inject({
            method: "POST",
            url: "/v1/auth/logout-all",
            headers: { authorization: `Bearer ${second.token}` },
        })

        assert.equal(logoutAll.statusCode, 200)

        for (const session of [first, second]) {
            const replay = await app.inject({
                method: "POST",
                url: "/v1/auth/refresh",
                cookies: { [conf.auth.refreshCookieName]: session.refreshCookie as string },
            })
            assert.equal(replay.statusCode, 401)
        }
    })

    it("OTP request is enumeration-safe (200 for unknown email)", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/v1/auth/otp-code",
            payload: { email: uniqueEmail("does-not-exist") },
        })

        assert.equal(response.statusCode, 200)
    })

    it("rate-limits repeated failed logins with 429", async () => {
        const victim = uniqueEmail("rate-limit")

        await app.inject({
            method: "POST",
            url: "/v1/auth/register",
            payload: { email: victim, password },
        })

        for (let i = 0; i < 5; i++) {
            await app.inject({
                method: "POST",
                url: "/v1/auth/login",
                payload: { email: victim, password: "wrong-password-999" },
            })
        }

        const limited = await login(app, victim, password)
        assert.equal(limited.statusCode, 429, "6th attempt inside the window must be rate limited")
    })
})

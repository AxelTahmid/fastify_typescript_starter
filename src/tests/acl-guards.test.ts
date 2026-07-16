import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { buildApp, login, seedAdminCredentials, uniqueEmail } from "./helper.js"

describe("acl route guards", async () => {
    let app: Awaited<ReturnType<typeof buildApp>>
    let customerToken: string
    let adminToken: string

    before(async () => {
        app = await buildApp()

        const email = uniqueEmail("acl-customer")
        const password = "test-password-123"
        await app.inject({
            method: "POST",
            url: "/v1/auth/register",
            payload: { email, password },
        })
        const customer = await login(app, email, password)
        assert.ok(customer.token, "customer login failed")
        customerToken = customer.token as string

        const adminCreds = seedAdminCredentials()
        const admin = await login(app, adminCreds.email, adminCreds.password)
        assert.ok(admin.token, "seed admin login failed — run the seeds before tests")
        adminToken = admin.token as string
    })

    after(async () => {
        await app.close()
    })

    it("anonymous requests to guarded routes get 401", async () => {
        const response = await app.inject({ method: "GET", url: "/v1/queue" })
        assert.equal(response.statusCode, 401)
    })

    it("customers hold no admin permissions — 403", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/v1/queue",
            headers: { authorization: `Bearer ${customerToken}` },
        })

        assert.equal(response.statusCode, 403)
    })

    it("admins pass permission gates via the system.admin wildcard", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/v1/queue",
            headers: { authorization: `Bearer ${adminToken}` },
        })

        assert.equal(response.statusCode, 200)
        assert.equal(response.json().error, false)
    })

    it("write gates reject read-only wildcard tokens on gallery delete", async () => {
        // customer: no gallery permissions at all
        const response = await app.inject({
            method: "DELETE",
            url: "/v1/gallery/?Key=whatever.png",
            headers: { authorization: `Bearer ${customerToken}` },
        })

        assert.equal(response.statusCode, 403)
    })

    it("access tokens carry expanded permissions", async () => {
        const payload = JSON.parse(Buffer.from(adminToken.split(".")[1] as string, "base64url").toString())
        assert.equal(payload.token_use, "access")
        assert.equal(payload.role, "admin")
        assert.ok(Array.isArray(payload.permissions))
        assert.ok(payload.permissions.includes("system.admin"))
        assert.ok(payload.permissions.includes("queue.read"), "wildcard must expand to concrete slugs at mint")
    })

    it("input guard rejects script-looking payloads on public writes", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/v1/auth/otp-code",
            payload: { email: "<script>alert(1)</script>@example.com" },
        })

        assert.equal(response.statusCode, 400)
    })
})

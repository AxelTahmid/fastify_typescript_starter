import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { buildApp } from "./helper.js"

describe("pg cache service", async () => {
    let app: Awaited<ReturnType<typeof buildApp>>
    const key = `test:cache:${Date.now()}`

    before(async () => {
        app = await buildApp()
    })

    after(async () => {
        await app.cache.flushPattern("test:*")
        await app.close()
    })

    it("set/get round-trips JSON values", async () => {
        await app.cache.set(key, { hello: "world", count: 2 }, 60)
        const value = await app.cache.get<{ hello: string; count: number }>(key)

        assert.deepEqual(value, { hello: "world", count: 2 })
    })

    it("get returns null for missing keys", async () => {
        const value = await app.cache.get(`${key}:missing`)
        assert.equal(value, null)
    })

    it("increment is atomic and window-scoped", async () => {
        const counterKey = `test:counter:${Date.now()}`

        assert.equal(await app.cache.increment(counterKey, 60), 1)
        assert.equal(await app.cache.increment(counterKey, 60), 2)
        assert.equal(await app.cache.increment(counterKey, 60), 3)
    })

    it("flush removes keys", async () => {
        await app.cache.set(`${key}:gone`, "x", 60)
        await app.cache.flush(`${key}:gone`)
        assert.equal(await app.cache.get(`${key}:gone`), null)
    })

    it("pruneExpired removes only dead rows", async () => {
        await app.cache.set("test:prune:dead", "x", 1)
        await app.cache.set("test:prune:alive", "y", 600)

        await new Promise((resolve) => setTimeout(resolve, 1100))
        await app.cache.pruneExpired()

        assert.equal(await app.cache.get("test:prune:dead"), null)
        assert.equal(await app.cache.get("test:prune:alive"), "y")
    })
})

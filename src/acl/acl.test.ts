import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PERMISSION_CATALOG } from "./catalog.js"
import { expandPermissions } from "./implied.js"
import { DEFAULT_ROLE_SLUG, ROLE_PRESETS } from "./presets.js"
import {
    ALL_PERMISSIONS,
    CONCRETE_PERMISSIONS,
    isPermission,
    Permission,
    READ_PERMISSIONS,
    WILDCARD_PERMISSIONS,
} from "./slugs.js"

describe("acl vocabulary", () => {
    it("every slug is module.action shaped", () => {
        for (const slug of ALL_PERMISSIONS) {
            assert.match(slug, /^[a-z]+\.[a-z]+$/, `bad slug shape: ${slug}`)
        }
    })

    it("slugs are unique", () => {
        assert.equal(new Set(ALL_PERMISSIONS).size, ALL_PERMISSIONS.length)
    })

    it("catalog covers every permission", () => {
        for (const slug of ALL_PERMISSIONS) {
            assert.ok(PERMISSION_CATALOG[slug], `catalog missing entry for ${slug}`)
            assert.ok(PERMISSION_CATALOG[slug].label.length > 0)
        }
    })

    it("isPermission accepts slugs and rejects noise", () => {
        assert.ok(isPermission("gallery.read"))
        assert.ok(!isPermission("gallery.delete"))
        assert.ok(!isPermission(42))
        assert.ok(!isPermission(undefined))
    })
})

describe("permission expansion", () => {
    it("concrete permissions expand only to themselves", () => {
        for (const slug of CONCRETE_PERMISSIONS) {
            const expanded = expandPermissions([slug])
            assert.deepEqual([...expanded], [slug], `${slug} should not imply anything`)
        }
    })

    it("write does NOT imply read", () => {
        const expanded = expandPermissions([Permission.GALLERY_WRITE])
        assert.ok(!expanded.has(Permission.GALLERY_READ), "gallery.write must not imply gallery.read")
    })

    it("system.admin expands to every concrete permission", () => {
        const expanded = expandPermissions([Permission.SYSTEM_ADMIN])
        for (const slug of CONCRETE_PERMISSIONS) {
            assert.ok(expanded.has(slug), `system.admin should imply ${slug}`)
        }
        assert.ok(expanded.has(Permission.SYSTEM_ADMIN), "wildcard itself stays in the set")
        assert.ok(!expanded.has(Permission.SYSTEM_VIEWER), "one wildcard must not imply the other")
    })

    it("system.viewer expands to exactly the read permissions", () => {
        const expanded = expandPermissions([Permission.SYSTEM_VIEWER])
        for (const slug of READ_PERMISSIONS) {
            assert.ok(expanded.has(slug), `system.viewer should imply ${slug}`)
        }
        for (const slug of CONCRETE_PERMISSIONS) {
            if (!slug.endsWith(".read")) {
                assert.ok(!expanded.has(slug), `system.viewer must not imply ${slug}`)
            }
        }
    })

    it("expansion is idempotent", () => {
        const once = expandPermissions([Permission.SYSTEM_ADMIN])
        const twice = expandPermissions(once)
        assert.deepEqual([...twice].sort(), [...once].sort())
    })
})

describe("role presets", () => {
    it("presets reference only known permissions", () => {
        for (const preset of ROLE_PRESETS) {
            for (const slug of preset.permissions) {
                assert.ok(isPermission(slug), `${preset.slug} grants unknown slug ${slug}`)
            }
        }
    })

    it("preset slugs are unique and include the default role", () => {
        const slugs = ROLE_PRESETS.map((preset) => preset.slug)
        assert.equal(new Set(slugs).size, slugs.length)
        assert.ok(slugs.includes(DEFAULT_ROLE_SLUG))
    })

    it("default role grants no admin permissions", () => {
        const preset = ROLE_PRESETS.find((entry) => entry.slug === DEFAULT_ROLE_SLUG)
        assert.ok(preset)
        assert.equal(expandPermissions(preset.permissions).size, 0)
    })

    it("wildcards are never both granted to one preset", () => {
        for (const preset of ROLE_PRESETS) {
            const wildcards = preset.permissions.filter((slug) =>
                (WILDCARD_PERMISSIONS as readonly Permission[]).includes(slug),
            )
            assert.ok(wildcards.length <= 1, `${preset.slug} grants multiple wildcards`)
        }
    })
})

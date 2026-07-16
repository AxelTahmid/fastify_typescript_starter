import { pathToFileURL } from "node:url"
import type { Kysely } from "kysely"
import { ALL_PERMISSIONS, PERMISSION_CATALOG, ROLE_PRESETS } from "#acl/index.js"
import { createDatabase } from "./connection.js"
import type { DB } from "./db.d.js"

/**
 * Reconcile the code-defined ACL vocabulary into the database:
 *  - permissions are upserted from the catalog and stale slugs removed
 *    (grants cascade away with them)
 *  - preset roles are upserted and their grants replaced to match code
 *  - operator-created roles are left untouched
 * Idempotent and transactional — safe to run on every deploy.
 */
export async function seedAcl(db: Kysely<DB>): Promise<void> {
    await db.transaction().execute(async (trx) => {
        for (const slug of ALL_PERMISSIONS) {
            const meta = PERMISSION_CATALOG[slug]
            await trx
                .insertInto("permissions")
                .values({ slug, label: meta.label, description: meta.description, module: meta.module })
                .onConflict((oc) =>
                    oc.column("slug").doUpdateSet({
                        label: meta.label,
                        description: meta.description,
                        module: meta.module,
                    }),
                )
                .execute()
        }

        await trx
            .deleteFrom("permissions")
            .where("slug", "not in", [...ALL_PERMISSIONS])
            .execute()

        const permissionRows = await trx.selectFrom("permissions").select(["id", "slug"]).execute()
        const permissionIdBySlug = new Map(permissionRows.map((row) => [row.slug, row.id]))

        for (const preset of ROLE_PRESETS) {
            await trx
                .insertInto("roles")
                .values({
                    slug: preset.slug,
                    label: preset.label,
                    description: preset.description,
                    is_system: true,
                })
                .onConflict((oc) =>
                    oc.column("slug").doUpdateSet({
                        label: preset.label,
                        description: preset.description,
                        is_system: true,
                    }),
                )
                .execute()

            const role = await trx
                .selectFrom("roles")
                .select("id")
                .where("slug", "=", preset.slug)
                .executeTakeFirstOrThrow()

            await trx.deleteFrom("role_permissions").where("role_id", "=", role.id).execute()

            const grants = preset.permissions.map((slug) => {
                const permissionId = permissionIdBySlug.get(slug)
                if (!permissionId) {
                    throw new Error(`Preset "${preset.slug}" grants unknown permission "${slug}"`)
                }
                return { role_id: role.id, permission_id: permissionId }
            })

            if (grants.length > 0) {
                await trx.insertInto("role_permissions").values(grants).execute()
            }
        }
    })

    console.log(`ACL seeded: ${ALL_PERMISSIONS.length} permissions, ${ROLE_PRESETS.length} preset roles`)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
    const db = createDatabase()
    try {
        await seedAcl(db)
    } finally {
        await db.destroy()
    }
}

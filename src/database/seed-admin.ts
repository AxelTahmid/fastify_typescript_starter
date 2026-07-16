import { pathToFileURL } from "node:url"
import type { Kysely } from "kysely"
import conf from "#config/environment.js"
import { hashPassword } from "#utils/password.js"
import { createDatabase } from "./connection.js"
import type { DB } from "./db.d.js"

/**
 * Ensure an initial administrator exists. Controlled by SEED_ADMIN_EMAIL /
 * SEED_ADMIN_PASSWORD; if the user already exists nothing is changed
 * (passwords are never overwritten by a seed).
 */
export async function seedAdmin(db: Kysely<DB>): Promise<void> {
    const existing = await db
        .selectFrom("auth_users")
        .select("id")
        .where("email", "=", conf.seed.adminEmail)
        .executeTakeFirst()

    if (existing) {
        console.log(`Admin seed skipped: ${conf.seed.adminEmail} already exists`)
        return
    }

    const adminRole = await db
        .selectFrom("roles")
        .select("id")
        .where("slug", "=", "admin")
        .executeTakeFirstOrThrow(() => new Error('Role "admin" not found — run the ACL seed first'))

    await db
        .insertInto("auth_users")
        .values({
            email: conf.seed.adminEmail,
            password: await hashPassword(conf.seed.adminPassword),
            email_verified: true,
            role_id: adminRole.id,
        })
        .execute()

    console.log(`Admin seeded: ${conf.seed.adminEmail}`)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
    const db = createDatabase()
    try {
        await seedAdmin(db)
    } finally {
        await db.destroy()
    }
}

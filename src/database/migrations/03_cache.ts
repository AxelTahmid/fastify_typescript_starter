import { type Kysely, sql } from "kysely"

/**
 * UNLOGGED key/value cache. Skipping the WAL makes writes cheap — contents
 * are lost on a crash, which is exactly right for a cache. Also backs
 * rate-limit counters and the refresh-token revocation denylist.
 */
export async function up(db: Kysely<any>): Promise<void> {
    await sql`
        CREATE UNLOGGED TABLE cache (
            key text PRIMARY KEY,
            value jsonb NOT NULL,
            expires_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `.execute(db)

    await db.schema.createIndex("cache_expires_at_idx").on("cache").column("expires_at").execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("cache").ifExists().execute()
}

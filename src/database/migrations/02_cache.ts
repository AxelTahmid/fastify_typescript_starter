import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("cache")
        .addColumn("key", "varchar(255)", (col) => col.primaryKey())
        .addColumn("value", "jsonb", (col) => col.notNull())
        .addColumn("expires_at", "timestamptz")
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("cache").ifExists().execute()
}

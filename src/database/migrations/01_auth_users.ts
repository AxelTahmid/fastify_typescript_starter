import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("auth_users")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("email", "varchar(100)", (col) => col.notNull().unique())
        .addColumn("password", "varchar(255)", (col) => col.notNull())
        .addColumn("email_verified", "boolean", (col) => col.notNull().defaultTo(false))
        .addColumn("role", sql`user_role`, (col) => col.notNull().defaultTo("customer"))
        .addColumn("is_banned", "boolean", (col) => col.notNull().defaultTo(false))
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("auth_users").ifExists().execute()
}

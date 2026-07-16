import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("auth_users")
        .addColumn("id", "integer", (col) => col.generatedAlwaysAsIdentity().primaryKey())
        .addColumn("email", "text", (col) => col.notNull().unique())
        .addColumn("password", "text", (col) => col.notNull())
        .addColumn("email_verified", "boolean", (col) => col.notNull().defaultTo(false))
        .addColumn("role_id", "integer", (col) => col.notNull().references("roles.id").onDelete("restrict"))
        .addColumn("is_banned", "boolean", (col) => col.notNull().defaultTo(false))
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute()

    await db.schema.createIndex("auth_users_role_id_idx").on("auth_users").column("role_id").execute()

    await sql`
        CREATE TRIGGER set_auth_users_updated_at
        BEFORE UPDATE ON auth_users
        FOR EACH ROW
        EXECUTE PROCEDURE set_updated_at();
    `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("auth_users").ifExists().execute()
}

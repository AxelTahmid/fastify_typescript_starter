import { type Kysely, sql } from "kysely"

/**
 * DB-backed ACL. The permission vocabulary lives in code (src/acl/slugs.ts)
 * and is synced into `permissions` by the seed; roles and their grants are
 * editable at runtime. `is_system` marks seeded preset roles that the
 * roles API must not delete.
 */
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("roles")
        .addColumn("id", "integer", (col) => col.generatedAlwaysAsIdentity().primaryKey())
        .addColumn("slug", "text", (col) => col.notNull().unique())
        .addColumn("label", "text", (col) => col.notNull())
        .addColumn("description", "text")
        .addColumn("is_system", "boolean", (col) => col.notNull().defaultTo(false))
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute()

    await sql`
        CREATE TRIGGER set_roles_updated_at
        BEFORE UPDATE ON roles
        FOR EACH ROW
        EXECUTE PROCEDURE set_updated_at();
    `.execute(db)

    await db.schema
        .createTable("permissions")
        .addColumn("id", "integer", (col) => col.generatedAlwaysAsIdentity().primaryKey())
        .addColumn("slug", "text", (col) => col.notNull().unique())
        .addColumn("label", "text", (col) => col.notNull())
        .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
        .addColumn("module", "text", (col) => col.notNull())
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute()

    await db.schema
        .createTable("role_permissions")
        .addColumn("role_id", "integer", (col) => col.notNull().references("roles.id").onDelete("cascade"))
        .addColumn("permission_id", "integer", (col) => col.notNull().references("permissions.id").onDelete("cascade"))
        .addPrimaryKeyConstraint("role_permissions_pk", ["role_id", "permission_id"])
        .execute()

    await db.schema
        .createIndex("role_permissions_permission_id_idx")
        .on("role_permissions")
        .column("permission_id")
        .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("role_permissions").ifExists().execute()
    await db.schema.dropTable("permissions").ifExists().execute()
    await db.schema.dropTable("roles").ifExists().execute()
}

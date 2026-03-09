import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    await sql`CREATE TYPE user_role AS ENUM ('customer', 'admin', 'manager');`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP TYPE IF EXISTS user_role;`.execute(db)
}

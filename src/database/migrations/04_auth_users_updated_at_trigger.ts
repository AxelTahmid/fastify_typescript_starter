import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    await sql`
        CREATE TRIGGER set_auth_users_updated_at
        BEFORE UPDATE ON auth_users
        FOR EACH ROW
        EXECUTE PROCEDURE set_updated_at();
    `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP TRIGGER IF EXISTS set_auth_users_updated_at ON auth_users;`.execute(db)
}

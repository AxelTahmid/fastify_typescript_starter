import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    await sql`
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP FUNCTION IF EXISTS set_updated_at;`.execute(db)
}

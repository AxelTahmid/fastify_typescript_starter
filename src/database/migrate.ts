import { promises as fs } from "node:fs"
import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
    DeduplicateJoinsPlugin,
    Kysely,
    type Migration,
    type MigrationProvider,
    Migrator,
    PostgresDialect,
} from "kysely"
import { Pool } from "pg"
import conf from "#config/environment.js"
import type { DB } from "./db.d.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const createDatabase = () => {
    const pool = new Pool(conf.database.pool)

    return new Kysely<DB>({
        dialect: new PostgresDialect({ pool }),
        plugins: [new DeduplicateJoinsPlugin()],
        log: conf.isDevEnvironment ? ["query", "error"] : ["error"],
    })
}

class CustomFileMigrationProvider implements MigrationProvider {
    constructor(private readonly folder: string) {}

    async getMigrations(): Promise<Record<string, Migration>> {
        const migrations: Record<string, Migration> = {}
        const files = await fs.readdir(this.folder)

        await Promise.all(
            files
                .filter((fileName) => fileName.endsWith(".ts") || fileName.endsWith(".js"))
                .map(async (fileName) => {
                    const migrationName = fileName.replace(/\.(ts|js)$/, "")
                    const fileUrl = pathToFileURL(path.join(this.folder, fileName)).href
                    const migration = await import(fileUrl)
                    migrations[migrationName] = migration
                }),
        )

        return migrations
    }
}

const getMigrator = (db: ReturnType<typeof createDatabase>) =>
    new Migrator({
        db,
        provider: new CustomFileMigrationProvider(path.resolve(__dirname, "migrations")),
    })

const command = process.argv[2]

const run = async () => {
    const db = createDatabase()
    const migrator = getMigrator(db)

    try {
        if (command === "status") {
            const migrations = await migrator.getMigrations()
            migrations.forEach((migration) => {
                console.log(`${migration.executedAt ? "executed" : "pending"} - ${migration.name}`)
            })
            return
        }

        const result =
            command === "up"
                ? await migrator.migrateUp()
                : command === "down"
                  ? await migrator.migrateDown()
                  : await migrator.migrateToLatest()

        result.results?.forEach((entry) => {
            console.log(`${entry.status} - ${entry.migrationName}`)
        })

        if (result.error) {
            console.error(result.error)
            process.exitCode = 1
        }
    } finally {
        await db.destroy()
    }
}

if (!command || !["up", "down", "latest", "status"].includes(command)) {
    console.error("Usage: tsx src/database/migrate.ts <up|down|latest|status>")
    process.exit(1)
}

await run()

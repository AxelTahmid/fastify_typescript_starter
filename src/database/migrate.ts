import { promises as fs } from "node:fs"
import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { type Migration, type MigrationProvider, Migrator, NO_MIGRATIONS } from "kysely/migration"
import { createDatabase } from "./connection.js"
import { seedAcl } from "./seed-acl.js"
import { seedAdmin } from "./seed-admin.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class CustomFileMigrationProvider implements MigrationProvider {
    constructor(private readonly folder: string) {}

    async getMigrations(): Promise<Record<string, Migration>> {
        const migrations: Record<string, Migration> = {}
        const files = await fs.readdir(this.folder)

        await Promise.all(
            files
                .filter((fileName) => !fileName.endsWith(".d.ts") && /\.(ts|js)$/.test(fileName))
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

const printResults = (results: readonly { status: string; migrationName: string }[] | undefined) => {
    results?.forEach((entry) => {
        console.log(`${entry.status} - ${entry.migrationName}`)
    })
}

const command = process.argv[2]

const run = async () => {
    const db = createDatabase()
    const migrator = getMigrator(db)

    try {
        switch (command) {
            case "status": {
                const migrations = await migrator.getMigrations()
                migrations.forEach((migration) => {
                    console.log(`${migration.executedAt ? "executed" : "pending"} - ${migration.name}`)
                })
                return
            }
            case "up": {
                const result = await migrator.migrateUp()
                printResults(result.results)
                if (result.error) throw result.error
                return
            }
            case "down": {
                const result = await migrator.migrateDown()
                printResults(result.results)
                if (result.error) throw result.error
                return
            }
            case "latest": {
                const result = await migrator.migrateToLatest()
                printResults(result.results)
                if (result.error) throw result.error
                return
            }
            case "reset": {
                console.log("Rolling back all migrations...")
                const rollback = await migrator.migrateTo(NO_MIGRATIONS)
                printResults(rollback.results)
                if (rollback.error) throw rollback.error

                console.log("Re-running all migrations...")
                const migrate = await migrator.migrateToLatest()
                printResults(migrate.results)
                if (migrate.error) throw migrate.error

                console.log("Seeding...")
                await seedAcl(db)
                await seedAdmin(db)
                return
            }
        }
    } catch (error) {
        console.error(error)
        process.exitCode = 1
    } finally {
        await db.destroy()
    }
}

if (!command || !["up", "down", "latest", "status", "reset"].includes(command)) {
    console.error("Usage: tsx src/database/migrate.ts <up|down|latest|status|reset>")
    process.exit(1)
}

await run()

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"

type SchemaModelLike = {
    toJSON?: () => { $id?: string; title?: string; [key: string]: unknown }
    valueOf?: () => { $id?: string; title?: string; [key: string]: unknown }
    $id?: string
    title?: string
    [key: string]: unknown
}

type SchemaModule = {
    models?: SchemaModelLike[]
    default?: {
        models?: SchemaModelLike[]
    }
}

const scanSchemaModules = (dirPath: string, modulePaths: string[]) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
            scanSchemaModules(fullPath, modulePaths)
            continue
        }

        if (
            entry.name === "schema.js" ||
            entry.name === "schemas.js" ||
            entry.name === "schema.ts" ||
            entry.name === "schemas.ts" ||
            entry.name.endsWith(".schema.js") ||
            entry.name.endsWith(".schemas.js") ||
            entry.name.endsWith(".schema.ts") ||
            entry.name.endsWith(".schemas.ts")
        ) {
            modulePaths.push(fullPath)
        }
    }
}

async function registerSchemas(fastify: FastifyInstance) {
    const currentFilePath = fileURLToPath(import.meta.url)
    const rootDir = path.resolve(path.join(path.dirname(currentFilePath), ".."))
    const appDir = path.join(rootDir, "app")
    const configSchemaJsPath = path.join(rootDir, "config", "schema.js")
    const configSchemaTsPath = path.join(rootDir, "config", "schema.ts")
    const configSchemaPath = fs.existsSync(configSchemaJsPath) ? configSchemaJsPath : configSchemaTsPath
    const registeredIds = new Set<string>()
    const modulePaths = [configSchemaPath]

    scanSchemaModules(appDir, modulePaths)
    modulePaths.sort((a, b) => a.localeCompare(b))

    for (const modulePath of modulePaths) {
        const schemaModule = (await import(modulePath)) as SchemaModule
        const models = Array.isArray(schemaModule.models) ? schemaModule.models : (schemaModule.default?.models ?? [])

        for (const model of models) {
            const json =
                model && typeof model.toJSON === "function"
                    ? model.toJSON()
                    : model && typeof model.valueOf === "function"
                      ? model.valueOf()
                      : model

            const schemaId = json?.$id
            if (!schemaId) {
                throw new Error(`Schema model in ${modulePath} is missing "$id".`)
            }
            if (registeredIds.has(schemaId)) {
                throw new Error(`Duplicate schema id "${schemaId}" found while loading ${modulePath}.`)
            }
            if (!json.title) {
                json.title = schemaId
            }

            fastify.addSchema(json as object)
            registeredIds.add(schemaId)
        }
    }
}

export default fp(registerSchemas, {
    fastify: ">=5.0.0",
    name: "schemas",
})

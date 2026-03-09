import { type Kysely, type SelectQueryBuilder, sql } from "kysely"
import type { DB } from "./db.d.js"

export const PG_ERROR_CODES = {
    unique: "23505",
    foreignKey: "23503",
    checkViolation: "23514",
    notNull: "23502",
} as const

export type PgErrorCode = (typeof PG_ERROR_CODES)[keyof typeof PG_ERROR_CODES]

export function isPgError(error: unknown, code: PgErrorCode): boolean {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === code
}

export interface PaginateOptions {
    page?: number
    perPage?: number
    orderBy?: string
    orderDirection?: "asc" | "desc"
}

export interface PaginationResult<T> {
    data: T[]
    total: number
    currentPage: number
    perPage: number
    lastPage: number
    hasNext: boolean
    hasPrev: boolean
}

export async function paginate<T>(
    _db: Kysely<DB>,
    query: SelectQueryBuilder<any, any, T>,
    options: PaginateOptions = {},
): Promise<PaginationResult<T>> {
    const currentPage = Math.max(1, options.page ?? 1)
    const perPage = Math.max(1, Math.min(options.perPage ?? 20, 100))
    const offset = (currentPage - 1) * perPage

    const countResult = await (query as any)
        .clearSelect()
        .clearOrderBy()
        .clearLimit()
        .clearOffset()
        .select((eb: any) => eb.fn.countAll().as("total"))
        .executeTakeFirst()

    const total = Number((countResult as { total?: number } | undefined)?.total ?? 0)
    const data = await (options.orderBy
        ? query.orderBy(sql.ref(options.orderBy), options.orderDirection ?? "desc")
        : query
    )
        .offset(offset)
        .limit(perPage)
        .execute()

    const lastPage = Math.ceil(total / perPage)

    return {
        data,
        total,
        currentPage,
        perPage,
        lastPage,
        hasNext: currentPage < lastPage,
        hasPrev: currentPage > 1,
    }
}

export const pgerr = PG_ERROR_CODES

export interface DbHealthInfo {
    version: string
    uptime: string
    connectionCount: number
}

export const getDbHealth = async (db: Kysely<DB>): Promise<DbHealthInfo> => {
    const result = await sql<{ version: string; uptime: string; connection_count: string }>`
        SELECT
            version() AS version,
            (current_timestamp - pg_postmaster_start_time())::text AS uptime,
            (
                SELECT count(*)::text
                FROM pg_stat_activity
                WHERE state = 'active'
            ) AS connection_count
    `.execute(db)
    const row = result.rows[0]

    return {
        version: row?.version?.split(" ")[0] ?? "PostgreSQL",
        uptime: row?.uptime ?? "0",
        connectionCount: Number(row?.connection_count ?? 0),
    }
}

export interface DbHelpers {
    paginate: <T>(query: SelectQueryBuilder<any, any, T>, options?: PaginateOptions) => Promise<PaginationResult<T>>
    pgerr: typeof pgerr
    isPgError: typeof isPgError
    health: () => Promise<DbHealthInfo>
}

export const createDbHelpers = (db: Kysely<DB>): DbHelpers => ({
    paginate: (query, options) => paginate(db, query, options),
    pgerr,
    isPgError,
    health: () => getDbHealth(db),
})

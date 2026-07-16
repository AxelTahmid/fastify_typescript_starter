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

/**
 * Composable query filters for list endpoints. All are no-ops when the
 * value is absent, so handlers can pipe query params straight through.
 */
export const filter = {
    /** Case-insensitive substring match across any of the given columns. */
    search<T>(query: SelectQueryBuilder<any, any, T>, columns: string[], term?: string) {
        if (!term?.trim() || columns.length === 0) {
            return query
        }
        const pattern = `%${term.trim()}%`
        return query.where((eb: any) => eb.or(columns.map((column) => eb(sql.ref(column), "ilike", pattern))))
    },

    /** Inclusive date range on a timestamp/date column. */
    date<T>(query: SelectQueryBuilder<any, any, T>, column: string, from?: string, to?: string) {
        let next = query
        if (from) {
            next = next.where(sql.ref(column), ">=", from) as typeof next
        }
        if (to) {
            next = next.where(sql.ref(column), "<=", to) as typeof next
        }
        return next
    },

    /** Exact match, skipped when the value is undefined/empty. */
    status<T>(query: SelectQueryBuilder<any, any, T>, column: string, value?: string | number | boolean) {
        if (value === undefined || value === "") {
            return query
        }
        return query.where(sql.ref(column), "=", value)
    },

    /**
     * Sorting restricted to an allow-list mapping API sort keys to real
     * columns — a client can never sort by an unexposed column.
     */
    sort<T>(
        query: SelectQueryBuilder<any, any, T>,
        allowed: Record<string, string>,
        sortBy?: string,
        direction: "asc" | "desc" = "desc",
    ) {
        const column = sortBy ? allowed[sortBy] : undefined
        if (!column) {
            return query
        }
        return query.orderBy(sql.ref(column), direction)
    },
}

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
    filter: typeof filter
    pgerr: typeof pgerr
    isPgError: typeof isPgError
    health: () => Promise<DbHealthInfo>
}

export const createDbHelpers = (db: Kysely<DB>): DbHelpers => ({
    paginate: (query, options) => paginate(db, query, options),
    filter,
    pgerr,
    isPgError,
    health: () => getDbHealth(db),
})

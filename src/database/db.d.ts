import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<string, string | undefined, string | undefined>
type NullableTimestamp = ColumnType<string | null, string | null | undefined, string | null | undefined>
type JsonValue = ColumnType<unknown, unknown, unknown>

export interface AuthUsers {
    id: Generated<number>
    email: string
    password: string
    email_verified: Generated<boolean>
    role: "customer" | "admin" | "manager"
    is_banned: Generated<boolean>
    created_at: Timestamp
    updated_at: Timestamp
}

export interface Cache {
    key: string
    value: JsonValue
    expires_at: NullableTimestamp
    created_at: Timestamp
}

export interface DB {
    auth_users: AuthUsers
    cache: Cache
}

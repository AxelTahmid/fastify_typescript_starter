import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<string, string | undefined, string | undefined>
type NullableTimestamp = ColumnType<string | null, string | null | undefined, string | null | undefined>
type JsonValue = ColumnType<unknown, unknown, unknown>

export interface AuthUsers {
    id: Generated<number>
    email: string
    password: string
    email_verified: Generated<boolean>
    role_id: number
    is_banned: Generated<boolean>
    created_at: Timestamp
    updated_at: Timestamp
}

export interface Roles {
    id: Generated<number>
    slug: string
    label: string
    description: string | null
    is_system: Generated<boolean>
    created_at: Timestamp
    updated_at: Timestamp
}

export interface Permissions {
    id: Generated<number>
    slug: string
    label: string
    description: Generated<string>
    module: string
    created_at: Timestamp
}

export interface RolePermissions {
    role_id: number
    permission_id: number
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
    permissions: Permissions
    role_permissions: RolePermissions
    roles: Roles
}

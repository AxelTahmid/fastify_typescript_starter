import type { Kysely } from "kysely"
import { isPermission, type Permission } from "#acl/index.js"
import type { DB } from "#database/db.d.js"

export interface AuthUserRecord {
    id: number
    email: string
    password: string
    email_verified: boolean
    role_id: number
    role: string
    is_banned: boolean
    created_at: string
    updated_at: string
}

const USER_COLUMNS = [
    "auth_users.id",
    "auth_users.email",
    "auth_users.password",
    "auth_users.email_verified",
    "auth_users.role_id",
    "auth_users.is_banned",
    "auth_users.created_at",
    "auth_users.updated_at",
    "roles.slug as role",
] as const

class AuthRepository {
    constructor(private readonly db: Kysely<DB>) {}

    public async getUserById(id: number): Promise<AuthUserRecord | undefined> {
        return this.db
            .selectFrom("auth_users")
            .innerJoin("roles", "roles.id", "auth_users.role_id")
            .select(USER_COLUMNS)
            .where("auth_users.id", "=", id)
            .executeTakeFirst() as Promise<AuthUserRecord | undefined>
    }

    public async getUserByEmail(email: string): Promise<AuthUserRecord | undefined> {
        return this.db
            .selectFrom("auth_users")
            .innerJoin("roles", "roles.id", "auth_users.role_id")
            .select(USER_COLUMNS)
            .where("auth_users.email", "=", email)
            .executeTakeFirst() as Promise<AuthUserRecord | undefined>
    }

    /** Granted (unexpanded) permission slugs for a role. */
    public async getPermissionSlugsForRole(roleId: number): Promise<Permission[]> {
        const rows = await this.db
            .selectFrom("role_permissions")
            .innerJoin("permissions", "permissions.id", "role_permissions.permission_id")
            .select("permissions.slug")
            .where("role_permissions.role_id", "=", roleId)
            .execute()

        return rows.map((row) => row.slug).filter(isPermission)
    }

    public async getRoleIdBySlug(slug: string): Promise<number | undefined> {
        const role = await this.db.selectFrom("roles").select("id").where("slug", "=", slug).executeTakeFirst()
        return role?.id
    }

    public async createUser(params: { email: string; password: string; role_id: number }): Promise<number> {
        const created = await this.db
            .insertInto("auth_users")
            .values({
                email: params.email,
                password: params.password,
                email_verified: false,
                role_id: params.role_id,
                is_banned: false,
            })
            .returning("id")
            .executeTakeFirstOrThrow()

        return created.id
    }

    public async updateUserEmailVerified(email: string): Promise<void> {
        await this.db.updateTable("auth_users").set({ email_verified: true }).where("email", "=", email).execute()
    }

    /** Returns the affected user id, or undefined when the email is unknown. */
    public async updateUserPassword(params: { email: string; password: string }): Promise<number | undefined> {
        const updated = await this.db
            .updateTable("auth_users")
            .set({ password: params.password })
            .where("email", "=", params.email)
            .returning("id")
            .executeTakeFirst()

        return updated?.id
    }
}

export default AuthRepository

import type { Kysely } from "kysely"
import type { DB } from "#database/db.d.js"

interface EmailPassObj {
    email: string
    password: string
}

class AuthRepository {
    constructor(private readonly db: Kysely<DB>) {}

    public async getUserById(id: number) {
        const user = await this.db.selectFrom("auth_users").selectAll().where("id", "=", id).executeTakeFirst()
        if (!user) throw new Error("User not found!")
        return user
    }

    public async getUserByEmail(email: string) {
        return this.db.selectFrom("auth_users").selectAll().where("email", "=", email).executeTakeFirst()
    }

    public async createUser({ email, password }: EmailPassObj) {
        const created = await this.db
            .insertInto("auth_users")
            .values({
                email,
                password,
                email_verified: false,
                role: "customer",
                is_banned: false,
            })
            .returning("id")
            .executeTakeFirstOrThrow()

        return created.id
    }

    public async updateUserEmailVerified(email: string) {
        const updated = await this.db
            .updateTable("auth_users")
            .set({ email_verified: true })
            .where("email", "=", email)
            .returning(["id", "email", "email_verified", "role", "is_banned", "created_at", "updated_at"])
            .executeTakeFirst()

        if (!updated) {
            throw new Error(`User: ${email} not found!`)
        }

        return updated
    }

    public async updateUserPassword({ email, password }: EmailPassObj) {
        const updated = await this.db
            .updateTable("auth_users")
            .set({ password })
            .where("email", "=", email)
            .returning("id")
            .executeTakeFirst()

        if (!updated) {
            throw new Error(`User: ${email} not found!`)
        }
    }
}

export default AuthRepository

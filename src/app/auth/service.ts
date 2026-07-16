import { randomInt } from "node:crypto"
import type { FastifyInstance } from "fastify"
import { DEFAULT_ROLE_SLUG, effectivePermissions } from "#acl/index.js"
import { hashPassword, verifyPassword } from "#utils/password.js"
import { assertRateLimit } from "#utils/rate-limit.js"
import type AuthRepository from "./repository.js"
import type { AuthUserRecord } from "./repository.js"
import type { ResetPassword, TokenPair, UserLogin } from "./types.js"

class AuthService {
    constructor(
        private readonly app: FastifyInstance,
        private readonly repo: AuthRepository,
    ) {}

    /** Mint a token pair with the user's permissions expanded at issue time. */
    private async issuePair(user: AuthUserRecord): Promise<TokenPair & { refreshJti: string }> {
        const granted = await this.repo.getPermissionSlugsForRole(user.role_id)
        return this.app.auth.issueTokenPair(
            {
                id: user.id,
                email: user.email,
                email_verified: user.email_verified,
                role: user.role,
            },
            effectivePermissions(granted),
        )
    }

    public async login(params: UserLogin): Promise<TokenPair> {
        const { email, password } = params
        await assertRateLimit(this.app, `login:${email}`, 5, 300)

        const user = await this.repo.getUserByEmail(email)
        if (!user) {
            // hash anyway so unknown emails cost the same time as bad passwords
            await hashPassword(password)
            throw this.app.httpErrors.unauthorized("Invalid email or password")
        }

        const match = await verifyPassword(user.password, password)
        if (!match) {
            throw this.app.httpErrors.unauthorized("Invalid email or password")
        }

        if (user.is_banned) {
            throw this.app.httpErrors.forbidden(`${user.email} is banned`)
        }

        return this.issuePair(user)
    }

    public async registration(params: UserLogin): Promise<TokenPair> {
        const { email, password } = params

        const roleId = await this.repo.getRoleIdBySlug(DEFAULT_ROLE_SLUG)
        if (!roleId) {
            throw new Error(`Default role "${DEFAULT_ROLE_SLUG}" missing — run the ACL seed`)
        }

        let userId: number
        try {
            userId = await this.repo.createUser({ email, password: await hashPassword(password), role_id: roleId })
        } catch (error) {
            if (this.app.db.isPgError(error, this.app.db.pgerr.unique)) {
                throw this.app.httpErrors.conflict("Email is already registered")
            }
            throw error
        }

        const user = await this.repo.getUserById(userId)
        if (!user) {
            throw new Error("User vanished during registration")
        }

        return this.issuePair(user)
    }

    /**
     * Rotate the session: verify the refresh token (signature, type,
     * denylist), re-read the user so bans/role changes take effect, revoke
     * the used jti, and mint a fresh pair.
     */
    public async refresh(refreshToken: string): Promise<TokenPair> {
        const payload = await this.app.auth.verifyRefreshToken(refreshToken)

        const user = await this.repo.getUserById(payload.id)
        if (!user || user.is_banned) {
            throw this.app.httpErrors.unauthorized("Session is no longer valid")
        }

        await this.app.auth.revokeRefreshToken(payload.jti)
        return this.issuePair(user)
    }

    /** Best-effort single logout — never throws, always ends with a cleared cookie. */
    public async logout(refreshToken: string | undefined): Promise<void> {
        if (!refreshToken) {
            return
        }
        try {
            const payload = await this.app.auth.verifyRefreshToken(refreshToken)
            await this.app.auth.revokeRefreshToken(payload.jti)
        } catch {
            // token invalid or already revoked — nothing to do
        }
    }

    public async logoutAll(userId: number): Promise<void> {
        await this.app.auth.revokeAllForUser(userId)
    }

    /**
     * Anti-enumeration: unknown emails get the same 200 as known ones —
     * the OTP email simply never arrives.
     */
    public async getOTP(email: string): Promise<void> {
        await assertRateLimit(this.app, `otp:${email}`, 3, 3600)

        const user = await this.repo.getUserByEmail(email)
        if (!user) {
            return
        }

        const otpCode = randomInt(100000, 1000000).toString()
        await this.app.cache.set(`otp:${email}`, otpCode, 1800)
        await this.app.queue.sendOtpEmail(email, otpCode)
    }

    public async verifyOTP(params: { code: string; email: string }): Promise<boolean> {
        const key = `otp:${params.email}`
        await assertRateLimit(this.app, `otp-verify:${params.email}`, 5, 900)

        const otp = await this.app.cache.get<string>(key)
        if (otp && otp === params.code) {
            await this.app.cache.flush(key)
            return true
        }
        return false
    }

    public async verifyUserEmail(email: string): Promise<TokenPair> {
        await this.repo.updateUserEmailVerified(email)

        const user = await this.repo.getUserByEmail(email)
        if (!user) {
            throw this.app.httpErrors.notFound(`User: ${email} not found`)
        }

        return this.issuePair(user)
    }

    /** Password reset revokes every existing session for the user. */
    public async updateUserPassword(params: ResetPassword): Promise<void> {
        const userId = await this.repo.updateUserPassword({
            email: params.email,
            password: await hashPassword(params.password),
        })

        if (userId) {
            await this.app.auth.revokeAllForUser(userId)
        }
    }
}

export default AuthService

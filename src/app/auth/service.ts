import type { FastifyInstance } from "fastify"
import { ofetch } from "ofetch"

import conf from "#config/environment.js"
import type AuthRepository from "./repository.js"
import type { ResetPassword, User, UserLogin } from "./types.js"

class AuthService {
    constructor(
        private readonly app: FastifyInstance,
        private readonly repo: AuthRepository,
    ) {}

    public async verifyCaptcha(token: string) {
        if (conf.isDevEnvironment) {
            return true
        }

        if (!conf.captcha.secret) {
            throw this.app.httpErrors.badRequest("Captcha failed, config not set!")
        }

        const data = await ofetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body: {
                secret: conf.captcha.secret,
                response: token,
            },
            timeout: 2000,
        })

        if (!data.success) {
            throw this.app.httpErrors.badRequest(`Captcha failed: ${data["error-codes"]?.[0] || "unknown"}`)
        }

        return true
    }

    public async authenticate(params: UserLogin) {
        const { email, password } = params
        const key = `timeout:${email}`
        let attempt = (await this.app.cache.get<number>(key)) || 0

        if (attempt >= 5) {
            throw this.app.httpErrors.forbidden("5 wrong attempts. Try again in 5 minutes.")
        }

        const user = await this.repo.getUserByEmail(email)
        if (!user) throw this.app.httpErrors.notFound(`User: ${email}, not found!`)

        const match = await this.app.bcrypt.compare(password, user.password)
        if (!match) {
            attempt += 1
            await this.app.cache.set(key, attempt, 300)
            throw this.app.httpErrors.forbidden("Password incorrect!")
        }

        await this.app.cache.flush(key)
        return this.app.auth.token(user)
    }

    public async registration(params: UserLogin) {
        const { email, password } = params
        const hashedPassword = await this.app.bcrypt.hash(password)
        const userId = await this.repo.createUser({ email, password: hashedPassword })
        return this.app.auth.token({
            id: userId,
            email,
            email_verified: false,
            role: "customer",
            is_banned: false,
        } as User)
    }

    public async verifyUserEmail(email: string) {
        const updatedUser = await this.repo.updateUserEmailVerified(email)
        return this.app.auth.token(updatedUser as User)
    }

    public async updateUserPassword(params: ResetPassword) {
        const { email, password } = params
        const hashedPassword = await this.app.bcrypt.hash(password)
        await this.repo.updateUserPassword({ email, password: hashedPassword })
    }

    public async getOTP(email: string) {
        const user = await this.repo.getUserByEmail(email)
        if (!user) throw this.app.httpErrors.notFound("User not found!")

        const otp_code = Math.random().toString().slice(2, 8)
        await this.app.cache.set(`otp:${email}`, otp_code, 1800)
        await this.app.queue.sendOtpEmail(email, otp_code)
        return otp_code
    }

    public async verifyOTP(params: { code: string; email: string }) {
        const key = `otp:${params.email}`
        const otp = await this.app.cache.get<string>(key)
        if (otp && otp === params.code) {
            await this.app.cache.flush(key)
            return true
        }
        return false
    }
}

export default AuthService

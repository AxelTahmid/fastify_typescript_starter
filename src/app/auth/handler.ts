import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import conf from "#config/environment.js"
import { clearRefreshCookie, setRefreshCookie } from "./refresh-cookie.js"
import type AuthRepository from "./repository.js"
import type AuthService from "./service.js"
import type { ReqOTPBody, ResetPassword, UserLogin, VerifyEmail } from "./types.js"

class AuthHandler {
    constructor(
        private readonly app: FastifyInstance,
        private readonly svc: AuthService,
        private readonly repo: AuthRepository,
    ) {}

    private readRefreshCookie = (req: FastifyRequest): string | undefined => req.cookies[conf.auth.refreshCookieName]

    /**
     * * POST /v1/auth/login
     */
    public login = async (req: FastifyRequest<{ Body: UserLogin }>, reply: FastifyReply) => {
        const pair = await this.svc.login(req.body)
        setRefreshCookie(reply, pair.refreshToken)

        reply.code(200)
        return {
            error: false,
            message: "Login successful",
            data: { token: pair.accessToken },
        }
    }

    /**
     * * POST /v1/auth/register
     */
    public register = async (req: FastifyRequest<{ Body: UserLogin }>, reply: FastifyReply) => {
        const pair = await this.svc.registration(req.body)
        setRefreshCookie(reply, pair.refreshToken)

        reply.code(201)
        return {
            error: false,
            message: "Registration successful",
            data: { token: pair.accessToken },
        }
    }

    /**
     * * POST /v1/auth/refresh
     */
    public refresh = async (req: FastifyRequest, reply: FastifyReply) => {
        const refreshToken = this.readRefreshCookie(req)
        if (!refreshToken) {
            throw this.app.httpErrors.unauthorized("Refresh token missing")
        }

        const pair = await this.svc.refresh(refreshToken)
        setRefreshCookie(reply, pair.refreshToken)

        reply.code(200)
        return {
            error: false,
            message: "Session refreshed",
            data: { token: pair.accessToken },
        }
    }

    /**
     * * POST /v1/auth/logout
     */
    public logout = async (req: FastifyRequest, reply: FastifyReply) => {
        await this.svc.logout(this.readRefreshCookie(req))
        clearRefreshCookie(reply)

        reply.code(200)
        return {
            error: false,
            message: "Logged out",
        }
    }

    /**
     * * POST /v1/auth/logout-all
     */
    public logoutAll = async (req: FastifyRequest, reply: FastifyReply) => {
        await this.svc.logoutAll(req.user.id)
        clearRefreshCookie(reply)

        reply.code(200)
        return {
            error: false,
            message: "Logged out everywhere",
        }
    }

    /**
     * * GET /v1/auth/me
     */
    public me = async (req: FastifyRequest, reply: FastifyReply) => {
        const user = await this.repo.getUserById(req.user.id)
        if (!user) {
            throw this.app.httpErrors.notFound("User not found")
        }

        const { password: _password, ...safeUser } = user

        reply.code(200)
        return {
            error: false,
            message: "User fetched",
            data: safeUser,
        }
    }

    /**
     * * POST /v1/auth/otp-code
     */
    public requestOTP = async (req: FastifyRequest<{ Body: ReqOTPBody }>, reply: FastifyReply) => {
        await this.svc.getOTP(req.body.email)

        reply.code(200)
        return {
            error: false,
            message: `If ${req.body.email} exists, an OTP is on its way`,
        }
    }

    /**
     * * POST /v1/auth/verify-email
     */
    public verifyEmail = async (req: FastifyRequest<{ Body: VerifyEmail }>, reply: FastifyReply) => {
        const email = req.user.email

        if (req.user.email_verified) {
            throw this.app.httpErrors.badRequest(`${email} already verified`)
        }

        const check = await this.svc.verifyOTP({ code: req.body.code, email })
        if (!check) {
            throw this.app.httpErrors.badRequest("OTP incorrect or expired")
        }

        const pair = await this.svc.verifyUserEmail(email)
        setRefreshCookie(reply, pair.refreshToken)

        reply.code(201)
        return {
            error: false,
            message: "User email verified",
            data: { token: pair.accessToken },
        }
    }

    /**
     * * POST /v1/auth/reset-password
     */
    public resetPassword = async (req: FastifyRequest<{ Body: ResetPassword }>, reply: FastifyReply) => {
        const { email, code } = req.body

        const check = await this.svc.verifyOTP({ code, email })
        if (!check) {
            throw this.app.httpErrors.badRequest("OTP incorrect or expired")
        }

        await this.svc.updateUserPassword(req.body)
        clearRefreshCookie(reply)

        reply.code(201)
        return {
            error: false,
            message: "Password changed — please log in again",
        }
    }
}

export default AuthHandler

import type { FastifySchema } from "fastify"
import { Type } from "typebox"

export namespace Data {
    export const userBody = Type.Object(
        {
            id: Type.Number(),
            email: Type.String({ minLength: 6, maxLength: 100, format: "email" }),
            email_verified: Type.Boolean(),
            role: Type.String(),
            is_banned: Type.Boolean(),
            created_at: Type.String(),
            updated_at: Type.String(),
        },
        { $id: "AuthUser" },
    )

    export const userLoginBody = Type.Object(
        {
            email: Type.String({ minLength: 6, maxLength: 100, format: "email" }),
            password: Type.String({ minLength: 8, maxLength: 128 }),
        },
        { $id: "AuthUserLogin" },
    )

    export const resetPasswordBody = Type.Object(
        {
            email: Type.String({ minLength: 6, maxLength: 100, format: "email" }),
            password: Type.String({ minLength: 8, maxLength: 128 }),
            code: Type.String({ minLength: 5, maxLength: 6 }),
        },
        { $id: "AuthResetPassword" },
    )

    export const verifyEmailBody = Type.Object(
        {
            code: Type.String({ minLength: 5, maxLength: 6 }),
        },
        { $id: "AuthVerifyEmail" },
    )

    export const reqOTPBody = Type.Object(
        {
            email: Type.String({ minLength: 6, maxLength: 100, format: "email" }),
        },
        { $id: "AuthOtpRequest" },
    )

    export const tokenBody = Type.Object(
        {
            token: Type.String(),
        },
        { $id: "AuthToken" },
    )
}

export const models = [
    Data.userBody,
    Data.userLoginBody,
    Data.resetPasswordBody,
    Data.verifyEmailBody,
    Data.reqOTPBody,
    Data.tokenBody,
]

const replySchema = (data?: object) => ({
    type: "object",
    properties: {
        error: { type: "boolean" },
        message: { type: "string" },
        ...(data ? { data } : {}),
    },
    required: ["error", "message"],
})

export namespace RouteSchema {
    export const login: FastifySchema = {
        summary: "Login",
        description: "Authenticate a user. Returns an access token; the refresh token is set as an httpOnly cookie.",
        tags: ["auth"],
        body: Data.userLoginBody,
        response: { 200: replySchema({ $ref: "AuthToken#" }) },
    }

    export const register: FastifySchema = {
        summary: "Register",
        description: "Register a new user with the default role",
        tags: ["auth"],
        body: Data.userLoginBody,
        response: { 201: replySchema({ $ref: "AuthToken#" }) },
    }

    export const refresh: FastifySchema = {
        summary: "Refresh session",
        description: "Exchange the refresh-token cookie for a new token pair (the refresh token is rotated)",
        tags: ["auth"],
        response: { 200: replySchema({ $ref: "AuthToken#" }) },
    }

    export const logout: FastifySchema = {
        summary: "Logout",
        description: "Revoke the current refresh token and clear its cookie",
        tags: ["auth"],
        response: { 200: replySchema() },
    }

    export const logoutAll: FastifySchema = {
        summary: "Logout everywhere",
        description: "Revoke every refresh token issued to the current user",
        tags: ["auth"],
        response: { 200: replySchema() },
    }

    export const me: FastifySchema = {
        summary: "Current user",
        description: "Fetch the authenticated user's profile",
        tags: ["auth"],
        response: { 200: replySchema({ $ref: "AuthUser#" }) },
    }

    export const requestOTP: FastifySchema = {
        summary: "Request OTP",
        description: "Send a one-time code to the given email (always responds 200 to prevent account enumeration)",
        tags: ["auth"],
        body: Data.reqOTPBody,
        response: { 200: replySchema() },
    }

    export const verifyEmail: FastifySchema = {
        summary: "Verify email",
        description: "Confirm the OTP sent to the user's email",
        tags: ["auth"],
        body: Data.verifyEmailBody,
        response: { 201: replySchema({ $ref: "AuthToken#" }) },
    }

    export const resetPassword: FastifySchema = {
        summary: "Reset password",
        description: "Set a new password using an emailed OTP; revokes all existing sessions",
        tags: ["auth"],
        body: Data.resetPasswordBody,
        response: { 201: replySchema() },
    }
}

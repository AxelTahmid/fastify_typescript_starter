import { Type } from "typebox"
import type { FastifySchema } from "fastify"

export namespace Data {
    export const userBody = Type.Object(
        {
            id: Type.Number(),
            email: Type.String({ minLength: 6, maxLength: 100, format: "email" }),
            email_verified: Type.Boolean(),
            role: Type.Union([Type.Literal("customer"), Type.Literal("admin"), Type.Literal("manager")]),
            is_banned: Type.Boolean(),
            created_at: Type.String(),
            updated_at: Type.String(),
        },
        { $id: "AuthUser" },
    )

    export const userLoginBody = Type.Object(
        {
            email: Type.String({ minLength: 6, maxLength: 100, format: "email" }),
            password: Type.String(),
            captchaToken: Type.String({ minLength: 1 }),
        },
        { $id: "AuthUserLogin" },
    )

    export const resetPasswordBody = Type.Object(
        {
            email: Type.String({ minLength: 6, maxLength: 100, format: "email" }),
            password: Type.String(),
            code: Type.String({ minLength: 5, maxLength: 6 }),
            captchaToken: Type.String({ minLength: 1 }),
        },
        { $id: "AuthResetPassword" },
    )

    export const verifyEmailBody = Type.Object(
        {
            code: Type.String({ minLength: 5, maxLength: 6 }),
            captchaToken: Type.String({ minLength: 1 }),
        },
        { $id: "AuthVerifyEmail" },
    )

    export const reqOTPBody = Type.Object(
        {
            email: Type.String({ minLength: 6, maxLength: 100, format: "email" }),
            captchaToken: Type.String({ minLength: 1 }),
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
        description: "Login existing user",
        tags: ["auth"],
        body: Data.userLoginBody,
        response: { 200: replySchema({ $ref: "AuthToken#" }) },
    }

    export const register: FastifySchema = {
        description: "Register new user",
        tags: ["auth"],
        body: Data.userLoginBody,
        response: { 201: replySchema({ $ref: "AuthToken#" }) },
    }

    export const me: FastifySchema = {
        description: "Fetch user information",
        tags: ["auth"],
        response: { 200: replySchema({ $ref: "AuthUser#" }) },
    }

    export const requestOTP: FastifySchema = {
        description: "Request OTP for user",
        tags: ["auth"],
        body: Data.reqOTPBody,
        response: { 200: replySchema() },
    }

    export const verifyEmail: FastifySchema = {
        description: "Verify user email",
        tags: ["auth"],
        body: Data.verifyEmailBody,
        response: { 201: replySchema({ $ref: "AuthToken#" }) },
    }

    export const resetPassword: FastifySchema = {
        description: "Reset user password",
        tags: ["auth"],
        body: Data.resetPasswordBody,
        response: { 201: replySchema() },
    }
}

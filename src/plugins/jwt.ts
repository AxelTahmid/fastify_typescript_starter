import fastifyJwt from "@fastify/jwt"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import fp from "fastify-plugin"
import config from "#config/environment.js"

type UserRole = "admin" | "manager" | "customer"

type JwtUser = {
    id: number
    email: string
    email_verified: boolean
    role: UserRole
    is_banned?: boolean
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: JwtUser
        user: JwtUser
    }
}

declare module "fastify" {
    interface FastifyInstance {
        authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
        auth: {
            token: (user: JwtUser) => Promise<string>
            verified: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
        }
        role: {
            admin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
            manager: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
            restricted: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
        }
    }
}

const forbidden = (reply: FastifyReply, message: string): never => {
    reply.code(403)
    throw new Error(message)
}

const unauthorized = (reply: FastifyReply, message: string): never => {
    reply.code(401)
    throw new Error(message)
}

const parseJwtKeys = () => ({
    privateKey: Buffer.from(config.auth.privateKeyBase64, "base64").toString("utf-8"),
    publicKey: Buffer.from(config.auth.publicKeyBase64, "base64").toString("utf-8"),
})

const verified = async (req: FastifyRequest, reply: FastifyReply) => {
    await req.jwtVerify()
    if (req.user.email_verified === false) {
        forbidden(reply, `User: ${req.user.email} is not verified`)
    }
}

const authenticated = async (req: FastifyRequest, reply: FastifyReply) => {
    await req.jwtVerify()
    if (req.user.is_banned) {
        forbidden(reply, `${req.user.email} is banned.`)
    }
}

const admin = async (req: FastifyRequest, reply: FastifyReply) => {
    await req.jwtVerify()
    if (req.user.role !== "admin") {
        unauthorized(reply, `${req.user.email} does not have permission`)
    }
}

const manager = async (req: FastifyRequest, reply: FastifyReply) => {
    await req.jwtVerify()
    if (req.user.role !== "manager") {
        unauthorized(reply, `${req.user.email} does not have permission`)
    }
}

const restricted = async (req: FastifyRequest, reply: FastifyReply) => {
    await req.jwtVerify()
    if (!["admin", "manager"].includes(req.user.role)) {
        forbidden(reply, `${req.user.email} does not have permission`)
    }
}

async function fastJWT(app: FastifyInstance) {
    if (!config.auth.privateKeyBase64 || !config.auth.publicKeyBase64) {
        app.log.error("JWT keys are not set in environment variables.")
        process.exit(1)
    }

    const { privateKey, publicKey } = parseJwtKeys()

    app.register(fastifyJwt, {
        secret: {
            private: privateKey,
            public: publicKey,
        },
        sign: { algorithm: "ES256" },
    })

    const token = async (user: JwtUser) =>
        app.jwt.sign(
            {
                id: user.id,
                email: user.email,
                email_verified: Boolean(user.email_verified),
                role: user.role,
                is_banned: Boolean(user.is_banned),
            },
            { expiresIn: config.auth.accessTokenExpiresInSeconds },
        )

    app.decorate("authenticate", authenticated)
    app.decorate("auth", {
        token,
        verified,
    })
    app.decorate("role", {
        admin,
        manager,
        restricted,
    })
}

export default fp(fastJWT, {
    fastify: ">=5.0.0",
    name: "jwt",
})

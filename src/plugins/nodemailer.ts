import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"
import { type SendMailOptions, type TransportOptions, type Transporter, createTransport } from "nodemailer"

type Opts = {
    transport: string | TransportOptions
    defaults?: Partial<SendMailOptions>
}

declare module "fastify" {
    interface FastifyInstance {
        mailer: Transporter
    }
}

async function fastifyMailer(fastify: FastifyInstance, options: Opts) {
    if (fastify.hasDecorator("mailer")) {
        return
    }

    const transporter = options.defaults
        ? createTransport(options.transport, options.defaults)
        : createTransport(options.transport)

    fastify.decorate("mailer", transporter)

    fastify.addHook("onClose", async () => {
        if (typeof transporter.close === "function") {
            transporter.close()
        }
    })
}

export default fp(fastifyMailer, {
    fastify: ">=5.0.0",
    name: "nodemailer",
})

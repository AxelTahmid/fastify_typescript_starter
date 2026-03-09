import type { FastifyInstance } from "fastify"
import type { SendOtpEmailPayload } from "./types.js"
import { renderOtpTemplate } from "../templates/otp.js"

export const createSendOtpEmailHandler =
    (app: FastifyInstance) =>
    async ([job]: Array<{ data: SendOtpEmailPayload }>) => {
        if (!job) {
            return
        }

        await app.mailer.sendMail({
            to: job.data.email,
            subject: "OTP Code",
            text: `OTP code is: ${job.data.otp_code}`,
            html: renderOtpTemplate(job.data.otp_code),
        })
    }

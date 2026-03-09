import { createSendOtpEmailHandler } from "./send-otp-email.js"
import type { JobTypeMap } from "./types.js"

export const JOB_NAMES = {
    SEND_OTP_EMAIL: "send-otp-email",
} as const

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES]

export { createSendOtpEmailHandler }
export type { JobTypeMap }

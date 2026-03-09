import type { Queue } from "pg-boss"
import { JOB_NAMES, type JobName } from "./workers/index.js"

export const queueConfigs: Record<JobName, Queue> = {
    [JOB_NAMES.SEND_OTP_EMAIL]: {
        name: JOB_NAMES.SEND_OTP_EMAIL,
        retryLimit: 3,
        retryDelay: 1000,
        retryBackoff: true,
        expireInSeconds: 60 * 60,
        deleteAfterSeconds: 7 * 24 * 60 * 60,
    },
}

import type { SendOptions } from "pg-boss"
import { QueueOperations } from "./base/index.js"
import { queueConfigs } from "./config.js"
import {
    createSendOtpEmailHandler,
    JOB_NAMES,
    type JobName,
    type JobTypeMap,
} from "./workers/index.js"

export * from "./base/index.js"
export * from "./config.js"
export * from "./workers/index.js"

export class Queue extends QueueOperations {
    async setupQueues(): Promise<void> {
        for (const queueName of Object.values(JOB_NAMES)) {
            const config = queueConfigs[queueName]
            await this.pgBoss.createQueue(queueName, {
                retryLimit: config.retryLimit,
                retryDelay: config.retryDelay,
                retryBackoff: config.retryBackoff,
                expireInSeconds: config.expireInSeconds,
                deleteAfterSeconds: config.deleteAfterSeconds,
            })
        }

        await this.pgBoss.work(JOB_NAMES.SEND_OTP_EMAIL, { batchSize: 1 }, createSendOtpEmailHandler(this.app))
    }

    async publishTypedJob<T extends JobName>(
        jobName: T,
        data: JobTypeMap[T],
        options?: SendOptions,
    ): Promise<string | null> {
        const config = queueConfigs[jobName]
        return this.publishJob(jobName, data, { ...config, ...options })
    }

    async sendOtpEmail(email: string, otpCode: string): Promise<string | null> {
        return this.publishTypedJob(JOB_NAMES.SEND_OTP_EMAIL, {
            email,
            otp_code: otpCode,
        })
    }
}

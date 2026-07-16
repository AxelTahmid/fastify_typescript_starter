export interface SendOtpEmailPayload {
    email: string
    otp_code: string
}

export type CachePrunePayload = Record<string, never>

export interface JobTypeMap {
    "send-otp-email": SendOtpEmailPayload
    "cache-prune": CachePrunePayload
}

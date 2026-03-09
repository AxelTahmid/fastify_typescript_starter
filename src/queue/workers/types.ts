export interface SendOtpEmailPayload {
    email: string
    otp_code: string
}

export interface JobTypeMap {
    "send-otp-email": SendOtpEmailPayload
}

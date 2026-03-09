import type { Static } from "typebox"
import type { Data } from "./schema.js"

export type User = Static<typeof Data.userBody>
export type UserLogin = Static<typeof Data.userLoginBody>
export type ResetPassword = Static<typeof Data.resetPasswordBody>
export type VerifyEmail = Static<typeof Data.verifyEmailBody>
export type ReqOTPBody = Static<typeof Data.reqOTPBody>
export type TokenBody = Static<typeof Data.tokenBody>

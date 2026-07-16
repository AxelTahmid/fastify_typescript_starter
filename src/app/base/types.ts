import type { Static } from "typebox"
import type { Data } from "./schema.js"

export type BaseResponse = Static<typeof Data.baseResponse>
export type CacheKeyBody = Static<typeof Data.cacheKeyBody>

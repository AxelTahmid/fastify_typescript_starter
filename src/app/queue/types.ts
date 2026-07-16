import type { Static } from "typebox"
import type { Data } from "./schema.js"

export type QueueNameParam = Static<typeof Data.queueNameParam>
export type QueueJobParams = Static<typeof Data.queueJobParams>

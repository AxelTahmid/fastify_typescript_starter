import type { Static } from "typebox"
import type { Data } from "./schema.js"

export type DestroyMany = Static<typeof Data.destroyManyBody>
export type KeyQueryString = Static<typeof Data.keyQueryParam>

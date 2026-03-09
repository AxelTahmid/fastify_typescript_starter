import { Type } from "typebox"

export const replyEnvelope = Type.Object(
    {
        error: Type.Boolean(),
        message: Type.String(),
        data: Type.Optional(Type.Unknown()),
    },
    { $id: "ReplyEnvelope" },
)

export const messageOnly = Type.Object(
    {
        error: Type.Boolean(),
        message: Type.String(),
    },
    { $id: "MessageOnly" },
)

export const models = [replyEnvelope, messageOnly]

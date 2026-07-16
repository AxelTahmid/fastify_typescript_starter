import { Permission } from "./slugs.js"

export interface PermissionMeta {
    /** Human-readable name shown in role editors. */
    label: string
    description: string
    /** Feature module the permission belongs to. */
    module: string
}

/**
 * Metadata for every permission. Keyed by the Permission enum, so adding
 * a slug without a catalog entry is a compile error — the catalog can
 * never drift from the vocabulary.
 */
export const PERMISSION_CATALOG: Record<Permission, PermissionMeta> = {
    [Permission.USER_READ]: {
        label: "View users",
        description: "List and inspect user accounts",
        module: "user",
    },
    [Permission.USER_WRITE]: {
        label: "Manage users",
        description: "Create, update, ban, and delete user accounts",
        module: "user",
    },
    [Permission.ROLE_READ]: {
        label: "View roles",
        description: "List roles and their granted permissions",
        module: "role",
    },
    [Permission.ROLE_WRITE]: {
        label: "Manage roles",
        description: "Create roles and change their granted permissions",
        module: "role",
    },
    [Permission.GALLERY_READ]: {
        label: "View gallery",
        description: "Browse uploaded media",
        module: "gallery",
    },
    [Permission.GALLERY_WRITE]: {
        label: "Manage gallery",
        description: "Upload and delete media, flush the media cache",
        module: "gallery",
    },
    [Permission.QUEUE_READ]: {
        label: "View queues",
        description: "Inspect background queues, jobs, and stats",
        module: "queue",
    },
    [Permission.QUEUE_WRITE]: {
        label: "Manage queues",
        description: "Cancel, retry, and purge background jobs",
        module: "queue",
    },
    [Permission.SYSTEM_ADMIN]: {
        label: "System administrator",
        description: "Wildcard — grants every permission",
        module: "system",
    },
    [Permission.SYSTEM_VIEWER]: {
        label: "System viewer",
        description: "Wildcard — grants every read permission",
        module: "system",
    },
}

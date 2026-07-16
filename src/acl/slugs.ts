/**
 * Single source of truth for every permission in the system, in
 * `module.action` form. Add new permissions here first — the catalog,
 * presets, and DB seed all derive from this enum, and TypeScript fails
 * the build anywhere a new slug is not accounted for.
 */
export enum Permission {
    // user management
    USER_READ = "user.read",
    USER_WRITE = "user.write",

    // role management
    ROLE_READ = "role.read",
    ROLE_WRITE = "role.write",

    // gallery / object storage
    GALLERY_READ = "gallery.read",
    GALLERY_WRITE = "gallery.write",

    // background queue administration
    QUEUE_READ = "queue.read",
    QUEUE_WRITE = "queue.write",

    /** Wildcard: expands to every grantable permission. */
    SYSTEM_ADMIN = "system.admin",
    /** Wildcard: expands to every `*.read` permission. */
    SYSTEM_VIEWER = "system.viewer",
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission)

export const WILDCARD_PERMISSIONS: readonly Permission[] = [Permission.SYSTEM_ADMIN, Permission.SYSTEM_VIEWER]

/** Every non-wildcard permission — what wildcards expand into. */
export const CONCRETE_PERMISSIONS: readonly Permission[] = ALL_PERMISSIONS.filter(
    (slug) => !WILDCARD_PERMISSIONS.includes(slug),
)

/** Every concrete read permission — what SYSTEM_VIEWER expands into. */
export const READ_PERMISSIONS: readonly Permission[] = CONCRETE_PERMISSIONS.filter((slug) => slug.endsWith(".read"))

const permissionSet = new Set<string>(ALL_PERMISSIONS)

export const isPermission = (value: unknown): value is Permission =>
    typeof value === "string" && permissionSet.has(value)

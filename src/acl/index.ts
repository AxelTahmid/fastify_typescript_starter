import { expandPermissions } from "./implied.js"
import type { Permission } from "./slugs.js"

export { PERMISSION_CATALOG, type PermissionMeta } from "./catalog.js"
export { expandPermissions } from "./implied.js"
export { DEFAULT_ROLE_SLUG, ROLE_PRESETS, type RolePreset } from "./presets.js"
export {
    ALL_PERMISSIONS,
    CONCRETE_PERMISSIONS,
    isPermission,
    Permission,
    READ_PERMISSIONS,
    WILDCARD_PERMISSIONS,
} from "./slugs.js"

/** Expanded effective permissions for a set of granted slugs. */
export const effectivePermissions = (granted: Iterable<Permission>): Permission[] => [...expandPermissions(granted)]

export const can = (held: ReadonlySet<Permission> | readonly Permission[], slug: Permission): boolean =>
    Array.isArray(held) ? held.includes(slug) : (held as ReadonlySet<Permission>).has(slug)

export const canAny = (held: ReadonlySet<Permission> | readonly Permission[], ...slugs: Permission[]): boolean =>
    slugs.some((slug) => can(held, slug))

export const canAll = (held: ReadonlySet<Permission> | readonly Permission[], ...slugs: Permission[]): boolean =>
    slugs.every((slug) => can(held, slug))

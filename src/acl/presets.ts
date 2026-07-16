import { Permission } from "./slugs.js"

export interface RolePreset {
    slug: string
    label: string
    description: string
    permissions: readonly Permission[]
}

/**
 * Built-in roles seeded into the database. These are starting points —
 * roles and their grants are editable at runtime through the roles API;
 * re-running the seed reconciles these presets without touching roles
 * created by operators.
 */
export const ROLE_PRESETS: readonly RolePreset[] = [
    {
        slug: "admin",
        label: "Administrator",
        description: "Full access to every feature",
        permissions: [Permission.SYSTEM_ADMIN],
    },
    {
        slug: "manager",
        label: "Manager",
        description: "Read everything, manage gallery media",
        permissions: [Permission.SYSTEM_VIEWER, Permission.GALLERY_WRITE],
    },
    {
        slug: "customer",
        label: "Customer",
        description: "Default role for self-registered users; no admin permissions",
        permissions: [],
    },
] as const

export const DEFAULT_ROLE_SLUG = "customer"

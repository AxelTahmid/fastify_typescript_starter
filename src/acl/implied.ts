import { CONCRETE_PERMISSIONS, Permission, READ_PERMISSIONS } from "./slugs.js"

/**
 * Explicit permission implication. Only wildcards expand — a write
 * permission never silently implies its read counterpart. If a role
 * should be able to read and write, grant both slugs (or use a wildcard).
 * Keeping implication explicit means a permission check always tells the
 * whole story.
 */
const IMPLIED: Partial<Record<Permission, readonly Permission[]>> = {
    [Permission.SYSTEM_ADMIN]: CONCRETE_PERMISSIONS,
    [Permission.SYSTEM_VIEWER]: READ_PERMISSIONS,
}

/**
 * Expand granted permissions to their transitive closure. Wildcards are
 * kept in the result alongside their expansion so checks against the
 * wildcard itself also pass.
 */
export function expandPermissions(granted: Iterable<Permission>): Set<Permission> {
    const expanded = new Set<Permission>()
    const stack = [...granted]

    while (stack.length > 0) {
        const slug = stack.pop() as Permission
        if (expanded.has(slug)) {
            continue
        }
        expanded.add(slug)

        const implied = IMPLIED[slug]
        if (implied) {
            stack.push(...implied)
        }
    }

    return expanded
}

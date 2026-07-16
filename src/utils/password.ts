import argon2 from "argon2"

/**
 * OWASP-recommended argon2id parameters (19 MiB memory, 2 iterations,
 * single lane). Shared by the fastify plugin and the seed scripts so
 * every hash in the system uses identical settings.
 */
const HASH_OPTIONS: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
}

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, HASH_OPTIONS)

export const verifyPassword = async (hash: string, plain: string): Promise<boolean> => {
    try {
        return await argon2.verify(hash, plain)
    } catch {
        // malformed/legacy hash — treat as non-match rather than a 500
        return false
    }
}

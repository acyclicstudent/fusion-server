/**
 * Matches a required permission against a list of granted permissions.
 *
 * Permissions are colon-separated tokens (e.g. "operations:read:own").
 * A granted token of "*" matches any required token at that position.
 *
 * Examples:
 *   hasPermission(["operations:read:*"], "operations:read:own")  // true
 *   hasPermission(["*"], "anything:you:want")                    // true
 *   hasPermission(["operations:*:own"], "operations:read:own")   // true
 *   hasPermission(["operations:read"], "operations:read:own")    // false (length mismatch)
 */
export function hasPermission(granted: string[], required: string): boolean {
    if (!granted || granted.length === 0) return false;
    if (granted.includes(required)) return true;
    if (granted.includes('*')) return true;

    const requiredParts = required.split(':');
    for (const perm of granted) {
        const parts = perm.split(':');
        if (parts.length !== requiredParts.length) continue;
        let match = true;
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] !== '*' && parts[i] !== requiredParts[i]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}

export function hasAllPermissions(granted: string[], required: string[]): boolean {
    return required.every(p => hasPermission(granted, p));
}

export function hasAnyPermission(granted: string[], required: string[]): boolean {
    return required.some(p => hasPermission(granted, p));
}

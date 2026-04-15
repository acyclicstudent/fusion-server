import { APIGatewayEvent } from 'aws-lambda';
import { AuthContext, IAuthContextResolver } from '../interfaces/auth-context';

/**
 * Default resolver: reads Cognito-style claims from
 * event.requestContext.authorizer.claims or .jwt.claims.
 *
 * Supports:
 *   - permissions: CSV string, JSON array string, or array
 *   - roles / areas: same as above
 *   - custom:permissions, custom:roles, custom:areas (Cognito custom attrs)
 *
 * Projects with custom authorizers should register their own resolver
 * under the AUTH_CONTEXT_RESOLVER token instead of relying on this one.
 */
export class DefaultCognitoAuthResolver implements IAuthContextResolver {
    resolve(event: APIGatewayEvent): AuthContext {
        const authorizer = (event?.requestContext as any)?.authorizer ?? {};
        const claims = authorizer.claims ?? authorizer.jwt?.claims ?? authorizer ?? {};

        return {
            userId:
                claims.sub ??
                claims.userId ??
                authorizer.principalId ??
                undefined,
            permissions: parseList(
                claims.permissions ?? claims['custom:permissions']
            ),
            roles: parseList(claims.roles ?? claims['cognito:groups'] ?? claims['custom:roles']),
            areas: parseList(claims.areas ?? claims['custom:areas']),
            raw: claims,
        };
    }
}

function parseList(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value !== 'string') return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
            return [];
        }
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
}

import { APIGatewayEvent } from 'aws-lambda';
import { AUTH_CONTEXT_EVENT_KEY, AuthContext } from '../../interfaces/auth-context';

/**
 * Helper to read the auth context attached by @RequirePermission (or @ResolveAuth).
 * Returns undefined if no resolver ran for this request.
 */
export function getAuthContext(event: APIGatewayEvent): AuthContext | undefined {
    return (event as any)?.[AUTH_CONTEXT_EVENT_KEY];
}

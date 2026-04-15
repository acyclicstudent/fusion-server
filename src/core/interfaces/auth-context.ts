import { APIGatewayEvent } from 'aws-lambda';

export interface AuthContext {
    userId?: string;
    permissions: string[];
    roles?: string[];
    areas?: string[];
    raw?: unknown;
    [key: string]: unknown;
}

export interface IAuthContextResolver {
    resolve(event: APIGatewayEvent): Promise<AuthContext> | AuthContext;
}

export const AUTH_CONTEXT_RESOLVER = 'fusion:auth-context-resolver';

export const AUTH_CONTEXT_EVENT_KEY = '__fusionAuth';

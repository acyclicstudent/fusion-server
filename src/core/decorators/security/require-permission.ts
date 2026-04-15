import { APIGatewayEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { FusionResponse } from '../../classes/fusion-response';
import { DefaultCognitoAuthResolver } from '../../classes/default-auth-resolver';
import {
    AUTH_CONTEXT_EVENT_KEY,
    AUTH_CONTEXT_RESOLVER,
    AuthContext,
    IAuthContextResolver,
} from '../../interfaces/auth-context';
import { hasAllPermissions, hasAnyPermission } from '../../utils/permission-matcher';

export interface RequirePermissionOptions {
    /** If 'all' (default), user must have every listed permission. If 'any', at least one. */
    mode?: 'all' | 'any';
    /** Customize the 403 body. Receives missing perms and the resolved auth context. */
    onDenied?: (info: { required: string[]; mode: 'all' | 'any'; auth: AuthContext }) => FusionResponse;
}

const defaultResolver = new DefaultCognitoAuthResolver();

/**
 * Require the caller to have the given permission(s) before executing the handler.
 *
 * Permission extraction is delegated to an `IAuthContextResolver` registered under
 * the `AUTH_CONTEXT_RESOLVER` token. If none is registered, falls back to reading
 * Cognito-style claims from requestContext.authorizer.
 *
 * Usage:
 *   @Get('/operations/:id')
 *   @RequirePermission('operations:read:own')
 *   async getOne(event) { ... }
 *
 *   @Post('/operations/:id/assign')
 *   @RequirePermission('operations:assign:area', 'operations:assign:*', { mode: 'any' })
 *   async assign(event) { ... }
 */
export function RequirePermission(
    ...args: (string | RequirePermissionOptions)[]
) {
    const maybeOpts = args[args.length - 1];
    const opts: RequirePermissionOptions =
        maybeOpts && typeof maybeOpts === 'object' ? (maybeOpts as RequirePermissionOptions) : {};
    const permissions = args.filter(a => typeof a === 'string') as string[];
    const mode: 'all' | 'any' = opts.mode ?? 'all';

    return function (target: any, propertyKey: string | symbol, descriptor?: PropertyDescriptor): any {
        // Legacy (TypeScript experimentalDecorators, esbuild __decorateClass) calls
        // us with 3 args and the descriptor; if we mutate target[propertyKey] alone,
        // __decorateClass later restores the ORIGINAL descriptor (bug source). TC39
        // decorators call with 2 args and no descriptor; then we must mutate the
        // prototype in place. Handle both.
        const original: Function = descriptor && descriptor.value
            ? descriptor.value
            : target[propertyKey];

        Reflect.defineMetadata(
            'fusion:permissions',
            { permissions, mode },
            target,
            propertyKey
        );

        const wrapped = async function (this: any, event: APIGatewayEvent, ...rest: any[]) {
            const resolver: IAuthContextResolver = container.isRegistered(AUTH_CONTEXT_RESOLVER)
                ? container.resolve<IAuthContextResolver>(AUTH_CONTEXT_RESOLVER)
                : defaultResolver;

            const auth = await resolver.resolve(event);
            (event as any)[AUTH_CONTEXT_EVENT_KEY] = auth;

            const granted = auth.permissions ?? [];
            const allowed =
                mode === 'any'
                    ? hasAnyPermission(granted, permissions)
                    : hasAllPermissions(granted, permissions);

            if (!allowed) {
                if (opts.onDenied) {
                    return opts.onDenied({ required: permissions, mode, auth });
                }
                return new FusionResponse({
                    message: 'Forbidden',
                    required: permissions,
                    mode,
                }).status(403);
            }

            return original.call(this, event, ...rest);
        };

        if (descriptor) {
            descriptor.value = wrapped;
            return descriptor;
        }
        target[propertyKey] = wrapped;
    };
}

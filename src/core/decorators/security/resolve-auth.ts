import { APIGatewayEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DefaultCognitoAuthResolver } from '../../classes/default-auth-resolver';
import {
    AUTH_CONTEXT_EVENT_KEY,
    AUTH_CONTEXT_RESOLVER,
    IAuthContextResolver,
} from '../../interfaces/auth-context';

const defaultResolver = new DefaultCognitoAuthResolver();

/**
 * Runs the configured IAuthContextResolver and attaches the result to the event,
 * WITHOUT enforcing any permission. Use on optional-auth endpoints so the handler
 * can still call getAuthContext(event).
 */
export function ResolveAuth() {
    return function (target: any, propertyKey: string | symbol, descriptor?: PropertyDescriptor): any {
        // Support both TC39 (2-arg) and legacy (3-arg) decorator calling conventions.
        // See the comment in require-permission.ts for why.
        const original: Function = descriptor && descriptor.value
            ? descriptor.value
            : target[propertyKey];

        const wrapped = async function (this: any, event: APIGatewayEvent, ...rest: any[]) {
            const resolver: IAuthContextResolver = container.isRegistered(AUTH_CONTEXT_RESOLVER)
                ? container.resolve<IAuthContextResolver>(AUTH_CONTEXT_RESOLVER)
                : defaultResolver;
            (event as any)[AUTH_CONTEXT_EVENT_KEY] = await resolver.resolve(event);
            return original.call(this, event, ...rest);
        };

        if (descriptor) {
            descriptor.value = wrapped;
            return descriptor;
        }
        target[propertyKey] = wrapped;
    };
}

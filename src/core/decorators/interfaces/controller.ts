import { injectable } from "tsyringe";

let controllerCounter = 0;

const HTTP_METADATA_KEYS = [
    'fusion:get',
    'fusion:post',
    'fusion:patch',
    'fusion:delete',
    'fusion:put',
] as const;

export function Controller(route: string): ClassDecorator {
    return function (target) {
        injectable()(target as any);

        // Unique id per decorated class so two @Controller with the same route
        // don't collide in the server's controller registry.
        const controllerId = `${route}#${target.name || 'Anonymous'}#${++controllerCounter}`;

        Reflect.defineMetadata('fusion:route', route, target);
        Reflect.defineMetadata('fusion:controller-id', controllerId, target);

        for (const key of HTTP_METADATA_KEYS) {
            const raw = Reflect.getMetadata(key, target) || {};
            const rewritten = Object.keys(raw).reduce((acc: any, sub) => {
                acc[`${route}${sub}`] = `${controllerId}|${raw[sub]}`;
                return acc;
            }, {});
            Reflect.defineMetadata(key, rewritten, target);
        }
    };
}

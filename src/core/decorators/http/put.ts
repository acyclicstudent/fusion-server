export function Put(route?: string) {
    return function (target: any, propertyKey: string) {
        const constructor = target.constructor;

        // Add to constructor fusion:put
        const puts = Reflect.getMetadata('fusion:put', constructor) || {};
        puts[`${route || ''}`] = `${propertyKey}`;
        Reflect.defineMetadata('fusion:put', puts, constructor);
    }
}

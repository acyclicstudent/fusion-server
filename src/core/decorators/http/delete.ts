export function Delete(route?: string) {
    return function (target: any, propertyKey: string) {
        const constructor = target.constructor;

        // Add to constructor fusion:delete
        const deletes = Reflect.getMetadata('fusion:delete', constructor) || {};
        deletes[`${route || ''}`] = `${propertyKey}`;
        Reflect.defineMetadata('fusion:delete', deletes, constructor);
    }
}
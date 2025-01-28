export function Patch(route?: string) {
    return function (target: any, propertyKey: string) {
        const constructor = target.constructor;

        // Add to constructor fusion:patch
        const patches = Reflect.getMetadata('fusion:patch', constructor) || {};
        patches[`${route || ''}`] = `${propertyKey}`;
        Reflect.defineMetadata('fusion:patch', patches, constructor);
    }
}
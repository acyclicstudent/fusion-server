export function Get(route?: string) {
    return function (target: any, propertyKey: string) {
        const constructor = target.constructor;
        
        // Add to constructor fusion:get
        const gets = Reflect.getMetadata('fusion:get', constructor) || {};
        gets[`${route || ''}`] = `${propertyKey}`;
        Reflect.defineMetadata('fusion:get', gets, constructor);
    }
} 
export function Post(route?: string) {
    return function (target: any, propertyKey: string) {
        const constructor = target.constructor;
        
        // Add to constructor fusion:post
        const posts = Reflect.getMetadata('fusion:post', constructor) || {};
        posts[`${route || ''}`] = `${propertyKey}`;
        Reflect.defineMetadata('fusion:post', posts, constructor);
    }
}
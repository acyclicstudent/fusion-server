export function Controller(route: string) {
    return function (target: any) {
        Reflect.defineMetadata('fusion:route', route, target);
        const gets = Reflect.getMetadata('fusion:get', target) || {};
        Reflect.defineMetadata(
            'fusion:get', 
            Object.keys(gets).reduce((previousValue: any, currentValue) => {
                previousValue[`${route}${currentValue}`] = `${route}|${gets[currentValue]}`;
                return previousValue;
            }, {}), 
            target
        );
        const posts = Reflect.getMetadata('fusion:post', target) || {};
        Reflect.defineMetadata(
            'fusion:post', 
            Object.keys(posts).reduce((previousValue: any, currentValue) => {
                previousValue[`${route}${currentValue}`] = `${route}|${posts[currentValue]}`;
                return previousValue;
            }, {}), 
            target
        );
        const patches = Reflect.getMetadata('fusion:patch', target) || {};
        Reflect.defineMetadata(
            'fusion:patch', 
            Object.keys(patches).reduce((previousValue: any, currentValue) => {
                previousValue[`${route}${currentValue}`] = `${route}|${patches[currentValue]}`;
                return previousValue;
            }, {}), 
            target
        );
        const deletes = Reflect.getMetadata('fusion:delete', target) || {};
        Reflect.defineMetadata(
            'fusion:delete', 
            Object.keys(deletes).reduce((previousValue: any, currentValue) => {
                previousValue[`${route}${currentValue}`] = `${route}|${deletes[currentValue]}`;
                return previousValue;
            }, {}), 
            target
        );
        const puts = Reflect.getMetadata('fusion:put', target) || {};
        Reflect.defineMetadata(
            'fusion:put', 
            Object.keys(puts).reduce((previousValue: any, currentValue) => {
                previousValue[`${route}${currentValue}`] = `${route}|${puts[currentValue]}`;
                return previousValue;
            }, {}), 
            target
        );
    }
}

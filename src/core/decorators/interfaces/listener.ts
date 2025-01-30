import { injectable } from "tsyringe"

export function Listener(event: string) : ClassDecorator {
    return (target) => {
        injectable()(target as any);
        Reflect.defineMetadata('fusion:listener', event, target);
    }
}
import { injectable } from 'tsyringe';
import { REGISTRY } from "../../registry";

export function Injectable(serviceIdentifier?: string): ClassDecorator {
    return (target) => {
        injectable()(target as any);
        if (serviceIdentifier) REGISTRY.set(serviceIdentifier, target)
    }
}
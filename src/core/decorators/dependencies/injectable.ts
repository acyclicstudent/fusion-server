import { injectable, container } from 'tsyringe';

const REGISTRY = new Map<string, any>();

export function Injectable(serviceIdentifier?: string): ClassDecorator {
    return (target: any) => {
        injectable()(target);
        if (serviceIdentifier) REGISTRY.set(serviceIdentifier, target)
    }
}

export function registerServices() {
    REGISTRY.forEach((implementation, identifier) => {
        container.register(identifier, { useClass: implementation });
    });
}
import { container } from "tsyringe";

export const REGISTRY = new Map<string, any>();

export function registerServices() {
    REGISTRY.forEach((implementation, identifier) => {
        container.register(identifier, { useClass: implementation });
    });
}
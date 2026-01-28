import { injectable } from "tsyringe"
import { ListenerConfig, ListenerMetadata, isPatternMatchConfig } from "../../interfaces/listener-config";

export function Listener(config: ListenerConfig) : ClassDecorator {
    return (target) => {
        injectable()(target as any);

        // Create metadata structure to distinguish between event name and pattern matching
        const metadata: ListenerMetadata = isPatternMatchConfig(config)
            ? { type: 'pattern', config }
            : { type: 'eventName', config };

        Reflect.defineMetadata('fusion:listener', metadata, target);
    }
}
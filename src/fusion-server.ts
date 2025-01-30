import { APIGatewayEvent, Context } from "aws-lambda";
import { container, InjectionToken } from "tsyringe";
import { registerServices } from "./core/registry";
import { EvtListener } from './core/interfaces/evt-listener';

export interface ICreateHandler {
    controllers: any[];
    dependencies?: InjectionToken<any>[];
    listeners?: InjectionToken<EvtListener>[];
}
export class FusionServer {
    private controllers: any = {};
    private listeners: {[event: string]: InjectionToken<EvtListener>} = {};
    private POST = {};
    private GET = {};
    private PUT = {};
    private DELETE = {};
    private PATCH = {};

    public createHandler(params: ICreateHandler) {
        // Register injectable services.
        registerServices();
        if (params.listeners) {
            // Register listeners
            params.listeners.forEach((handler: InjectionToken<EvtListener>) => {
                this.listeners[Reflect.getMetadata('fusion:listener', handler)] = handler;
            });
        }
        params.controllers.forEach((controller: Function) => {
            this.controllers[Reflect.getMetadata('fusion:route', controller)] = controller;
            Object.assign(this.GET, Reflect.getMetadata('fusion:get', controller))
            Object.assign(this.POST, Reflect.getMetadata('fusion:post', controller))
            Object.assign(this.DELETE, Reflect.getMetadata('fusion:delete', controller))
            Object.assign(this.PUT, Reflect.getMetadata('fusion:put', controller))
            Object.assign(this.PATCH, Reflect.getMetadata('fusion:patch', controller))
        });
        return async (evt: any, context: Context) => {
            let stage = context.invokedFunctionArn.split(":").pop() || 'dev';
            if (!['dev', 'qa', 'staging', 'prod'].includes(stage)) stage = 'dev';
            container.register('stage', { useValue: stage });

            if (evt.event) return await this.handleListener(evt);

            return await this.handleController(evt);
        }
    }

    private async handleListener(evt: any) {
        try {
            if (!(evt.event in this.listeners)) throw new Error(`Unregistered listener \"${evt.event}\"`)
            const listener = await container.resolve(this.listeners[evt.event]);

            return {
                success: true,
                body: await listener.handle(evt)
            }
        } catch (err) {
            return {
                success: false,
                body: {
                    message: (err as any).message
                }
            }
        }
    }

    private async handleController(event: APIGatewayEvent) {
        try { 
            const [controllerPath, handler] = (this as any)[event.httpMethod]?.[event.resource]?.split('|') || [];
            if (!controllerPath) throw new Error(`Unregistered controller for route ${event.httpMethod} ${event.resource}`); 
            const controller: any = await container.resolve(this.controllers[controllerPath]);

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    await controller[handler](event)
                )
            }
        } catch (err) {
            console.error(err);
            return {
                statusCode: (err as any).code || 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    {
                        message: (err as any).message
                    }
                )
            }
        }
    }
}
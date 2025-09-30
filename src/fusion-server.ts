import { APIGatewayEvent, Context } from "aws-lambda";
import { container, InjectionToken } from "tsyringe";
import { registerServices } from "./core/registry";
import { EvtListener } from './core/interfaces/evt-listener';
import { FusionResponse } from './core/classes/fusion-response';

export interface ICorsConfig {
    enabled: boolean;
    allowOrigins?: string[];
    allowMethods?: string[];
    allowHeaders?: string[];
    exposeHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}

export interface ICreateHandler {
    controllers: any[];
    dependencies?: InjectionToken<any>[];
    listeners?: InjectionToken<EvtListener>[];
    cors?: ICorsConfig;
}
export class FusionServer {
    private controllers: any = {};
    private listeners: {[event: string]: InjectionToken<EvtListener>} = {};
    private POST = {};
    private GET = {};
    private PUT = {};
    private DELETE = {};
    private PATCH = {};
    private corsConfig?: ICorsConfig;

    public createHandler(params: ICreateHandler) {
        this.validateHandlerParams(params);

        // Store CORS configuration
        this.corsConfig = params.cors;

        // Register injectable services.
        registerServices();
        
        if (params.listeners) {
            // Register listeners
            params.listeners.forEach((handler: InjectionToken<EvtListener>) => {
                const eventName = Reflect.getMetadata('fusion:listener', handler);
                if (!eventName) {
                    console.warn(`[FusionServer Warning] Listener ${handler.toString()} is missing @Listener decorator`);
                    return;
                }
                this.listeners[eventName] = handler;
            });
        }
        
        params.controllers.forEach((controller: Function) => {
            const route = Reflect.getMetadata('fusion:route', controller);
            if (!route) {
                console.warn(`[FusionServer Warning] Controller ${controller.name} is missing @Controller decorator`);
                return;
            }
            
            this.controllers[route] = controller;
            Object.assign(this.GET, Reflect.getMetadata('fusion:get', controller) || {})
            Object.assign(this.POST, Reflect.getMetadata('fusion:post', controller) || {})
            Object.assign(this.DELETE, Reflect.getMetadata('fusion:delete', controller) || {})
            Object.assign(this.PUT, Reflect.getMetadata('fusion:put', controller) || {})
            Object.assign(this.PATCH, Reflect.getMetadata('fusion:patch', controller) || {})
        });
        
        return async (evt: any, context: Context) => {
            try {
                let stage = context.invokedFunctionArn.split(":").pop() || 'dev';
                if (!['dev', 'qa', 'staging', 'prod'].includes(stage)) stage = 'dev';
                container.register('stage', { useValue: stage });

                if (evt.event) return await this.handleListener(evt);

                return await this.handleController(evt);
            } catch (err) {
                console.error('[FusionServer Handler Error]', {
                    message: (err as any).message,
                    stack: (err as any).stack,
                    event: evt,
                    context: context,
                    timestamp: new Date().toISOString()
                });
                
                return {
                    statusCode: 500,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'Internal server error',
                        requestId: context.awsRequestId
                    })
                };
            }
        }
    }

    private validateHandlerParams(params: ICreateHandler): void {
        if (!params.controllers || !Array.isArray(params.controllers) || params.controllers.length === 0) {
            throw new Error('At least one controller is required');
        }
        
        params.controllers.forEach((controller, index) => {
            if (typeof controller !== 'function') {
                throw new Error(`Controller at index ${index} must be a class constructor`);
            }
        });
        
        if (params.listeners) {
            if (!Array.isArray(params.listeners)) {
                throw new Error('Listeners must be an array');
            }
            
            params.listeners.forEach((listener, index) => {
                if (typeof listener !== 'function') {
                    throw new Error(`Listener at index ${index} must be a class constructor`);
                }
            });
        }
    }

    private async handleListener(evt: any) {
        try {
            if (!evt.event) {
                throw new Error('Event name is required but not provided');
            }
            
            if (!(evt.event in this.listeners)) {
                throw new Error(`Unregistered listener for event: ${evt.event}`);
            }
            
            const listenerClass = this.listeners[evt.event];
            const listener = await container.resolve(listenerClass);
            
            if (!listener) {
                throw new Error(`Failed to resolve listener instance for event: ${evt.event}`);
            }
            
            if (typeof listener.handle !== 'function') {
                throw new Error(`Listener for event '${evt.event}' does not implement handle() method`);
            }

            const result = await listener.handle(evt);
            
            return {
                success: true,
                body: result
            }
        } catch (err) {
            const error = err as any;
            console.error('[FusionServer Listener Error]', {
                message: error.message,
                stack: error.stack,
                event: evt.event,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: false,
                body: {
                    message: error.message || 'Listener execution failed',
                    event: evt.event
                }
            }
        }
    }

    private applyCorsHeaders(headers: { [key: string]: string }, origin?: string): void {
        if (!this.corsConfig?.enabled) return;

        const config = this.corsConfig;

        // Handle origin
        if (config.allowOrigins) {
            if (origin && config.allowOrigins.includes(origin)) {
                headers['Access-Control-Allow-Origin'] = origin;
            } else if (config.allowOrigins.includes('*')) {
                headers['Access-Control-Allow-Origin'] = '*';
            } else if (config.allowOrigins.length > 0) {
                headers['Access-Control-Allow-Origin'] = config.allowOrigins[0];
            }
        }

        // Handle methods
        if (config.allowMethods && config.allowMethods.length > 0) {
            headers['Access-Control-Allow-Methods'] = config.allowMethods.join(', ');
        }

        // Handle headers
        if (config.allowHeaders && config.allowHeaders.length > 0) {
            headers['Access-Control-Allow-Headers'] = config.allowHeaders.join(', ');
        }

        // Handle expose headers
        if (config.exposeHeaders && config.exposeHeaders.length > 0) {
            headers['Access-Control-Expose-Headers'] = config.exposeHeaders.join(', ');
        }

        // Handle credentials
        if (config.credentials) {
            headers['Access-Control-Allow-Credentials'] = 'true';
        }

        // Handle max age
        if (config.maxAge !== undefined) {
            headers['Access-Control-Max-Age'] = config.maxAge.toString();
        }
    }

    private async handleController(event: APIGatewayEvent) {
        try {
            const routeKey = `${event.httpMethod} ${event.resource}`;
            const routeConfig = (this as any)[event.httpMethod]?.[event.resource];

            if (!routeConfig) {
                throw new Error(`Unregistered controller for route ${routeKey}`);
            }
            
            const [controllerPath, handler] = routeConfig.split('|');
            
            if (!controllerPath || !handler) {
                throw new Error(`Invalid route configuration for ${routeKey}: ${routeConfig}`);
            }
            
            const controllerClass = this.controllers[controllerPath];
            if (!controllerClass) {
                throw new Error(`Controller class not found for path: ${controllerPath}`);
            }
            
            const controller: any = await container.resolve(controllerClass);
            
            if (!controller) {
                throw new Error(`Failed to resolve controller instance for: ${controllerPath}`);
            }
            
            if (typeof controller[handler] !== 'function') {
                throw new Error(`Method '${handler}' not found in controller '${controllerPath}' or is not a function`);
            }

            const result = await controller[handler](event);
            const origin = event.headers?.origin || event.headers?.Origin;

            // Check if result is a FusionResponse instance
            if (result instanceof FusionResponse) {
                const response = result.toResponse();
                this.applyCorsHeaders(response.headers, origin);
                return response;
            }

            // Handle empty responses (undefined, null)
            if (result === undefined || result === null) {
                const headers: { [key: string]: string } = {};
                this.applyCorsHeaders(headers, origin);
                return {
                    statusCode: 204, // No Content
                    headers,
                    body: ''
                };
            }

            // Default behavior for backward compatibility
            const headers: { [key: string]: string } = {
                'Content-Type': 'application/json'
            };
            this.applyCorsHeaders(headers, origin);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            }
        } catch (err) {
            const error = err as any;
            console.error('[FusionServer Error]', {
                message: error.message,
                stack: error.stack,
                route: `${event.httpMethod} ${event.resource}`,
                requestId: event.requestContext?.requestId,
                timestamp: new Date().toISOString()
            });

            const headers: { [key: string]: string } = {
                'Content-Type': 'application/json'
            };
            const origin = event.headers?.origin || event.headers?.Origin;
            this.applyCorsHeaders(headers, origin);

            return {
                statusCode: error.code || 500,
                headers,
                body: JSON.stringify({
                    message: error.message || 'Internal server error',
                    requestId: event.requestContext?.requestId
                })
            }
        }
    }
}
import { APIGatewayEvent, Context } from 'aws-lambda';
import { container, InjectionToken } from 'tsyringe';
import { registerServices } from './core/registry';
import { EvtListener } from './core/interfaces/evt-listener';
import { FusionResponse } from './core/classes/fusion-response';
import {
  ListenerMetadata,
  ListenerMatchConfig,
} from './core/interfaces/listener-config';
import { matchesPatterns } from './core/utils/pattern-matcher';

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
  private listeners: {
    eventName: { [event: string]: InjectionToken<EvtListener> };
    patterns: Array<{
      handler: InjectionToken<EvtListener>;
      config: ListenerMatchConfig;
    }>;
  } = {
    eventName: {},
    patterns: [],
  };
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
        const metadata: ListenerMetadata = Reflect.getMetadata(
          'fusion:listener',
          handler
        );
        if (!metadata) {
          console.warn(
            `[FusionServer Warning] Listener ${handler.toString()} is missing @Listener decorator`
          );
          return;
        }

        // Route to appropriate storage based on metadata type
        if (metadata.type === 'eventName') {
          this.listeners.eventName[metadata.config as string] = handler;
        } else if (metadata.type === 'pattern') {
          this.listeners.patterns.push({
            handler,
            config: metadata.config as ListenerMatchConfig,
          });
        }
      });
    }

    params.controllers.forEach((controller: Function) => {
      const route = Reflect.getMetadata('fusion:route', controller);
      if (!route) {
        console.warn(
          `[FusionServer Warning] Controller ${controller.name} is missing @Controller decorator`
        );
        return;
      }

      this.controllers[route] = controller;
      Object.assign(
        this.GET,
        Reflect.getMetadata('fusion:get', controller) || {}
      );
      Object.assign(
        this.POST,
        Reflect.getMetadata('fusion:post', controller) || {}
      );
      Object.assign(
        this.DELETE,
        Reflect.getMetadata('fusion:delete', controller) || {}
      );
      Object.assign(
        this.PUT,
        Reflect.getMetadata('fusion:put', controller) || {}
      );
      Object.assign(
        this.PATCH,
        Reflect.getMetadata('fusion:patch', controller) || {}
      );
    });

    return async (evt: any, context: Context) => {
      try {
        let stage = context.invokedFunctionArn.split(':').pop() || 'dev';
        if (!['dev', 'qa', 'staging', 'prod'].includes(stage)) stage = 'dev';
        container.register('stage', { useValue: stage });

        if (this.shouldHandleAsListener(evt)) {
          return await this.handleListener(evt);
        }

        return await this.handleController(evt);
      } catch (err) {
        console.error('[FusionServer Handler Error]', {
          message: (err as any).message,
          stack: (err as any).stack,
          event: evt,
          context: context,
          timestamp: new Date().toISOString(),
        });

        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Internal server error',
            requestId: context.awsRequestId,
          }),
        };
      }
    };
  }

  private shouldHandleAsListener(evt: any): boolean {
    // Check if event has event name property (explicit listener event)
    if (evt.event) {
      return true;
    }

    // Check if this looks like an API Gateway event (has httpMethod and resource)
    // If so, it should be routed to controller, not listener
    if (evt.httpMethod && evt.resource) {
      return false;
    }

    // For non-API Gateway events, check if we have pattern listeners
    // If we have pattern listeners registered, route to listener system
    // (which will give proper error if no pattern matches)
    if (this.listeners.patterns.length > 0) {
      return true;
    }

    // No pattern listeners registered, let it fall through to controller
    return false;
  }

  private validateHandlerParams(params: ICreateHandler): void {
    if (
      !params.controllers ||
      !Array.isArray(params.controllers) ||
      params.controllers.length === 0
    ) {
      throw new Error('At least one controller is required');
    }

    params.controllers.forEach((controller, index) => {
      if (typeof controller !== 'function') {
        throw new Error(
          `Controller at index ${index} must be a class constructor`
        );
      }
    });

    if (params.listeners) {
      if (!Array.isArray(params.listeners)) {
        throw new Error('Listeners must be an array');
      }

      params.listeners.forEach((listener, index) => {
        if (typeof listener !== 'function') {
          throw new Error(
            `Listener at index ${index} must be a class constructor`
          );
        }
      });
    }
  }

  private async handleListener(evt: any) {
    try {
      let listenerClass: InjectionToken<EvtListener> | undefined;
      let matchType: 'eventName' | 'pattern' = 'eventName';

      // Priority 1: Try event-name lookup (backward compatible, O(1))
      if (evt.event && evt.event in this.listeners.eventName) {
        listenerClass = this.listeners.eventName[evt.event];
        matchType = 'eventName';
      }
      // Priority 2: Try pattern matching (O(n*m))
      else {
        for (const pattern of this.listeners.patterns) {
          if (matchesPatterns(evt, pattern.config)) {
            listenerClass = pattern.handler;
            matchType = 'pattern';
            break; // First registered pattern wins
          }
        }
      }

      // No matching listener found
      if (!listenerClass) {
        const eventKeys = Object.keys(evt)
          .slice(0, 10)
          .join(', ');
        const truncatedKeys = Object.keys(evt).length > 10 ? '...' : '';

        throw new Error(
          evt.event
            ? `Unregistered listener for event: ${evt.event}`
            : `No pattern-matched listener found for event structure. Event keys: ${eventKeys}${truncatedKeys}`
        );
      }

      const listener = await container.resolve(listenerClass);

      if (!listener) {
        throw new Error(`Failed to resolve listener instance`);
      }

      if (typeof listener.handle !== 'function') {
        throw new Error(`Listener does not implement handle() method`);
      }

      const result = await listener.handle(evt);

      // Check if result is a FusionResponse instance
      if (result instanceof FusionResponse) {
        // If FusionResponse has custom headers or non-200 status, use API Gateway format
        const hasCustomHeaders = Object.keys(result.headers).length > 0;
        const hasCustomStatus = result.statusCode !== 200;

        if (hasCustomHeaders || hasCustomStatus) {
          // Return API Gateway response format (for services expecting HTTP-like responses)
          return result.toResponse();
        } else {
          // Return raw object (for services like Bedrock, Cognito expecting direct objects)
          return result.toObject();
        }
      }

      // Default behavior for backward compatibility
      return {
        success: true,
        matchType,
        body: result,
      };
    } catch (err) {
      const error = err as any;
      console.error('[FusionServer Listener Error]', {
        message: error.message,
        stack: error.stack,
        event: evt.event || 'pattern-matched',
        eventStructure: evt,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        body: {
          message: error.message || 'Listener execution failed',
          event: evt.event || 'pattern-matched',
        },
      };
    }
  }

  private applyCorsHeaders(
    headers: { [key: string]: string },
    origin?: string
  ): void {
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
      headers['Access-Control-Expose-Headers'] = config.exposeHeaders.join(
        ', '
      );
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
        throw new Error(
          `Invalid route configuration for ${routeKey}: ${routeConfig}`
        );
      }

      const controllerClass = this.controllers[controllerPath];
      if (!controllerClass) {
        throw new Error(
          `Controller class not found for path: ${controllerPath}`
        );
      }

      const controller: any = await container.resolve(controllerClass);

      if (!controller) {
        throw new Error(
          `Failed to resolve controller instance for: ${controllerPath}`
        );
      }

      if (typeof controller[handler] !== 'function') {
        throw new Error(
          `Method '${handler}' not found in controller '${controllerPath}' or is not a function`
        );
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
          body: '',
        };
      }

      // Default behavior for backward compatibility
      const headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
      };
      this.applyCorsHeaders(headers, origin);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result),
      };
    } catch (err) {
      const error = err as any;
      console.error('[FusionServer Error]', {
        message: error.message,
        stack: error.stack,
        route: `${event.httpMethod} ${event.resource}`,
        requestId: event.requestContext?.requestId,
        timestamp: new Date().toISOString(),
      });

      const headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
      };
      const origin = event.headers?.origin || event.headers?.Origin;
      this.applyCorsHeaders(headers, origin);

      return {
        statusCode: error.code || 500,
        headers,
        body: JSON.stringify({
          message: error.message || 'Internal server error',
          requestId: event.requestContext?.requestId,
        }),
      };
    }
  }
}

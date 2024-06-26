import { APIGatewayEvent, Context } from "aws-lambda";

export interface ICreateHandler {
    controllers: any[];
}
export class FusionServer {
    private controllers: any = {};
    private POST = {};
    private GET = {};
    private PUT = {};
    private DELETE = {};
    private PATCH = {};

    public createHandler(params: ICreateHandler) {
        params.controllers.forEach((controller: Function) => {
            this.controllers[Reflect.getMetadata('fusion:route', controller)] = controller;
            Object.assign(this.GET, Reflect.getMetadata('fusion:get', controller))
            Object.assign(this.POST, Reflect.getMetadata('fusion:post', controller))
            Object.assign(this.DELETE, Reflect.getMetadata('fusion:delete', controller))
            Object.assign(this.PUT, Reflect.getMetadata('fusion:put', controller))
            Object.assign(this.PATCH, Reflect.getMetadata('fusion:patch', controller))
        });
        return async (event: APIGatewayEvent, context: Context) => {
            try { 
                let stage = context.invokedFunctionArn.split(":").pop() || 'dev';
                if (!['dev', 'qa', 'staging', 'prod'].includes(stage)) stage = 'dev'
                console.log('Running Stage: ', stage);
                
                const [controllerPath, handler] = (this as any)[event.httpMethod][event.resource].split('|'); 
                const controller = await new this.controllers[controllerPath]();

                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(
                        await controller[handler](stage, event)
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
}
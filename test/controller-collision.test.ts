import 'reflect-metadata';
import { Controller } from '../src/core/decorators/interfaces/controller';
import { Get } from '../src/core/decorators/http/get';
import { Post } from '../src/core/decorators/http/post';
import { FusionServer } from '../src/fusion-server';

function apiEvent(httpMethod: string, resource: string): any {
  return {
    httpMethod,
    resource,
    headers: {},
    requestContext: { requestId: 'test' },
  };
}

const lambdaContext = {
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:0:function:fn:dev',
  awsRequestId: 'test-req',
} as any;

describe('Controller collision (same @Controller path)', () => {
  it('assigns unique controller-id metadata to each @Controller class', () => {
    class ReadCtrl {}
    Controller('/users')(ReadCtrl as any);

    class WriteCtrl {}
    Controller('/users')(WriteCtrl as any);

    const idA = Reflect.getMetadata('fusion:controller-id', ReadCtrl);
    const idB = Reflect.getMetadata('fusion:controller-id', WriteCtrl);

    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
    expect(idA).toContain('/users');
    expect(idB).toContain('/users');
  });

  it('embeds controller-id (not just route) in http metadata values', () => {
    class SomeCtrl {
      getOne(_evt: any) {}
    }
    Get('/{id}')(SomeCtrl.prototype, 'getOne');
    Controller('/items')(SomeCtrl as any);

    const gets = Reflect.getMetadata('fusion:get', SomeCtrl);
    const value = gets['/items/{id}'];
    expect(typeof value).toBe('string');
    const [idPart, method] = value.split('|');
    expect(method).toBe('getOne');
    expect(idPart).toContain('/items');
    expect(idPart).toContain('SomeCtrl');
  });

  it('routes to the correct controller when two share the same @Controller path', async () => {
    class UsersReadCtrl {
      async getOne(_evt: any) {
        return { from: 'read', action: 'getOne' };
      }
    }
    Get('/{id}')(UsersReadCtrl.prototype, 'getOne');
    Controller('/users')(UsersReadCtrl as any);

    class UsersWriteCtrl {
      async create(_evt: any) {
        return { from: 'write', action: 'create' };
      }
    }
    Post('/')(UsersWriteCtrl.prototype, 'create');
    Controller('/users')(UsersWriteCtrl as any);

    const server = new FusionServer();
    const handler = server.createHandler({
      controllers: [UsersReadCtrl, UsersWriteCtrl],
    });

    const readResp = await handler(apiEvent('GET', '/users/{id}'), lambdaContext);
    expect(readResp.statusCode).toBe(200);
    expect(JSON.parse(readResp.body)).toEqual({ from: 'read', action: 'getOne' });

    const writeResp = await handler(apiEvent('POST', '/users/'), lambdaContext);
    expect(writeResp.statusCode).toBe(200);
    expect(JSON.parse(writeResp.body)).toEqual({ from: 'write', action: 'create' });
  });

  it('routes correctly regardless of registration order', async () => {
    class CtrlA {
      async listA(_evt: any) {
        return 'A';
      }
    }
    Get('/a')(CtrlA.prototype, 'listA');
    Controller('/shared')(CtrlA as any);

    class CtrlB {
      async listB(_evt: any) {
        return 'B';
      }
    }
    Get('/b')(CtrlB.prototype, 'listB');
    Controller('/shared')(CtrlB as any);

    // Register B first, then A
    const handler = new FusionServer().createHandler({
      controllers: [CtrlB, CtrlA],
    });

    const respA = await handler(apiEvent('GET', '/shared/a'), lambdaContext);
    const respB = await handler(apiEvent('GET', '/shared/b'), lambdaContext);

    expect(JSON.parse(respA.body)).toBe('A');
    expect(JSON.parse(respB.body)).toBe('B');
  });

  it('warns on real route conflicts (same method + resource) and last wins', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    class First {
      async handle(_evt: any) {
        return 'first';
      }
    }
    Get('/thing')(First.prototype, 'handle');
    Controller('/conflict')(First as any);

    class Second {
      async handle(_evt: any) {
        return 'second';
      }
    }
    Get('/thing')(Second.prototype, 'handle');
    Controller('/conflict')(Second as any);

    const handler = new FusionServer().createHandler({
      controllers: [First, Second],
    });

    const resp = await handler(apiEvent('GET', '/conflict/thing'), lambdaContext);
    expect(JSON.parse(resp.body)).toBe('second');

    const conflictWarn = warnSpy.mock.calls.find(call =>
      String(call[0]).includes('Route conflict')
    );
    expect(conflictWarn).toBeDefined();
    expect(String(conflictWarn![0])).toContain('GET /conflict/thing');

    warnSpy.mockRestore();
  });

  it('does not warn when only the @Controller prefix overlaps but resources differ', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    class ReadC {
      async r(_evt: any) {
        return 'r';
      }
    }
    Get('/{id}')(ReadC.prototype, 'r');
    Controller('/items')(ReadC as any);

    class WriteC {
      async w(_evt: any) {
        return 'w';
      }
    }
    Post('/')(WriteC.prototype, 'w');
    Controller('/items')(WriteC as any);

    new FusionServer().createHandler({ controllers: [ReadC, WriteC] });

    const conflictWarn = warnSpy.mock.calls.find(call =>
      String(call[0]).includes('Route conflict')
    );
    expect(conflictWarn).toBeUndefined();
    warnSpy.mockRestore();
  });
});

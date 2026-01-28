import 'reflect-metadata';
import { Get } from '../src/core/decorators/http/get';
import { Post } from '../src/core/decorators/http/post';
import { Controller } from '../src/core/decorators/interfaces/controller';
import { Listener } from '../src/core/decorators/interfaces/listener';

describe('Decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Method Decorators', () => {
    it('should create GET decorator function', () => {
      const getDecorator = Get('/users');
      expect(typeof getDecorator).toBe('function');
    });

    it('should create POST decorator function', () => {
      const postDecorator = Post('/users');
      expect(typeof postDecorator).toBe('function');
    });

    it('should set metadata when GET decorator is applied', () => {
      class TestController {}
      
      const getDecorator = Get('/users');
      getDecorator(TestController.prototype, 'getUsers');

      const metadata = Reflect.getMetadata('fusion:get', TestController);
      expect(metadata).toEqual({
        '/users': 'getUsers'
      });
    });

    it('should set metadata when POST decorator is applied', () => {
      class TestController {}
      
      const postDecorator = Post('/users');
      postDecorator(TestController.prototype, 'createUser');

      const metadata = Reflect.getMetadata('fusion:post', TestController);
      expect(metadata).toEqual({
        '/users': 'createUser'
      });
    });

    it('should handle empty routes', () => {
      class TestController {}
      
      const getDecorator = Get();
      getDecorator(TestController.prototype, 'getRoot');

      const metadata = Reflect.getMetadata('fusion:get', TestController);
      expect(metadata).toEqual({
        '': 'getRoot'
      });
    });

    it('should accumulate multiple routes', () => {
      class TestController {}
      
      const get1 = Get('/first');
      const get2 = Get('/second');
      
      get1(TestController.prototype, 'first');
      get2(TestController.prototype, 'second');

      const metadata = Reflect.getMetadata('fusion:get', TestController);
      expect(metadata).toEqual({
        '/first': 'first',
        '/second': 'second'
      });
    });
  });

  describe('Controller Decorator', () => {
    it('should create controller decorator function', () => {
      const controllerDecorator = Controller('/api');
      expect(typeof controllerDecorator).toBe('function');
    });

    it('should set route metadata and process existing HTTP methods', () => {
      class TestController {}
      
      // First add some HTTP method metadata
      const getDecorator = Get('/list');
      getDecorator(TestController.prototype, 'list');
      
      // Then apply controller decorator
      const controllerDecorator = Controller('/api/users');
      controllerDecorator(TestController);

      // Check route metadata
      const routeMetadata = Reflect.getMetadata('fusion:route', TestController);
      expect(routeMetadata).toBe('/api/users');

      // Check that HTTP methods are prefixed with controller route
      const getMetadata = Reflect.getMetadata('fusion:get', TestController);
      expect(getMetadata).toEqual({
        '/api/users/list': '/api/users|list'
      });
    });
  });

  describe('Listener Decorator', () => {
    it('should create listener decorator function', () => {
      const listenerDecorator = Listener('user.created');
      expect(typeof listenerDecorator).toBe('function');
    });

    it('should set event metadata', () => {
      class TestListener {}

      const listenerDecorator = Listener('user.created');
      listenerDecorator(TestListener);

      const metadata = Reflect.getMetadata('fusion:listener', TestListener);
      expect(metadata).toEqual({ type: 'eventName', config: 'user.created' });
    });
  });

  describe('Decorator Integration', () => {
    it('should work with multiple HTTP methods and controller', () => {
      class TestController {}
      
      // Add HTTP methods first
      Get('/')(TestController.prototype, 'list');
      Get('/:id')(TestController.prototype, 'get');
      Post('/')(TestController.prototype, 'create');
      
      // Apply controller decorator
      const controllerDecorator = Controller('/api/items');
      controllerDecorator(TestController);

      // Verify all metadata
      expect(Reflect.getMetadata('fusion:route', TestController)).toBe('/api/items');
      
      const getMetadata = Reflect.getMetadata('fusion:get', TestController);
      expect(getMetadata['/api/items/']).toBe('/api/items|list');
      expect(getMetadata['/api/items/:id']).toBe('/api/items|get');

      const postMetadata = Reflect.getMetadata('fusion:post', TestController);
      expect(postMetadata['/api/items/']).toBe('/api/items|create');
    });

    it('should not interfere between controllers and listeners', () => {
      class TestController {}
      class TestListener {}

      // Apply decorators
      Controller('/api')(TestController);
      Listener('test.event')(TestListener);

      // Verify separation
      expect(Reflect.getMetadata('fusion:route', TestController)).toBe('/api');
      expect(Reflect.getMetadata('fusion:listener', TestListener)).toEqual({ type: 'eventName', config: 'test.event' });

      expect(Reflect.getMetadata('fusion:listener', TestController)).toBeUndefined();
      expect(Reflect.getMetadata('fusion:route', TestListener)).toBeUndefined();
    });
  });
});
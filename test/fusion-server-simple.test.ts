import 'reflect-metadata';
import { FusionServer } from '../src/fusion-server';

describe('FusionServer Basic Functionality', () => {
  let server: FusionServer;
  
  beforeEach(() => {
    server = new FusionServer();
  });

  describe('createHandler - Basic Validation', () => {
    it('should create a server instance', () => {
      expect(server).toBeInstanceOf(FusionServer);
    });

    it('should throw error if no controllers provided', () => {
      expect(() => {
        server.createHandler({ controllers: [] });
      }).toThrow('At least one controller is required');
    });

    it('should throw error if controllers is null', () => {
      expect(() => {
        server.createHandler({ controllers: null as any });
      }).toThrow('At least one controller is required');
    });

    it('should throw error if controller is not a function', () => {
      expect(() => {
        server.createHandler({ controllers: ['invalid' as any] });
      }).toThrow('Controller at index 0 must be a class constructor');
    });

    it('should create handler with valid controller', () => {
      class TestController {}
      
      const handler = server.createHandler({ controllers: [TestController] });
      
      expect(typeof handler).toBe('function');
    });

    it('should validate listeners parameter', () => {
      class TestController {}
      
      expect(() => {
        server.createHandler({ 
          controllers: [TestController], 
          listeners: 'invalid' as any 
        });
      }).toThrow('Listeners must be an array');
    });

    it('should validate listener items', () => {
      class TestController {}
      
      expect(() => {
        server.createHandler({ 
          controllers: [TestController], 
          listeners: ['invalid' as any] 
        });
      }).toThrow('Listener at index 0 must be a class constructor');
    });

    it('should accept valid listeners', () => {
      class TestController {}
      class TestListener {
        handle(_event: any) {
          return { processed: true };
        }
      }
      
      const handler = server.createHandler({ 
        controllers: [TestController],
        listeners: [TestListener]
      });
      
      expect(typeof handler).toBe('function');
    });
  });

  describe('Handler Function', () => {
    it('should return a function that handles events', () => {
      class TestController {}
      
      const handler = server.createHandler({ controllers: [TestController] });
      
      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2); // Should accept event and context parameters
    });
  });
});
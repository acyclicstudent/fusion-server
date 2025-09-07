import { FusionResponse } from '../src/core/classes/fusion-response';

describe('FusionResponse', () => {
  describe('Constructor and Basic Usage', () => {
    it('should create instance with default values', () => {
      const response = new FusionResponse();
      
      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({});
      expect(response.body).toBe(null);
    });

    it('should create instance with initial body', () => {
      const data = { message: 'test' };
      const response = new FusionResponse(data);
      
      expect(response.body).toEqual(data);
    });
  });

  describe('Status Code Methods', () => {
    it('should set custom status code with chaining', () => {
      const response = new FusionResponse({ data: 'test' })
        .status(201);
      
      expect(response.statusCode).toBe(201);
    });

    it('should support convenience status methods', () => {
      expect(FusionResponse.ok().statusCode).toBe(200);
      expect(FusionResponse.created().statusCode).toBe(201);
      expect(FusionResponse.accepted().statusCode).toBe(202);
      expect(FusionResponse.noContent().statusCode).toBe(204);
      expect(FusionResponse.badRequest().statusCode).toBe(400);
      expect(FusionResponse.unauthorized().statusCode).toBe(401);
      expect(FusionResponse.forbidden().statusCode).toBe(403);
      expect(FusionResponse.notFound().statusCode).toBe(404);
      expect(FusionResponse.conflict().statusCode).toBe(409);
      expect(FusionResponse.internalServerError().statusCode).toBe(500);
    });

    it('should include default messages for error status codes', () => {
      expect(FusionResponse.badRequest().body).toEqual({ message: 'Bad Request' });
      expect(FusionResponse.notFound().body).toEqual({ message: 'Not Found' });
      expect(FusionResponse.unauthorized().body).toEqual({ message: 'Unauthorized' });
    });

    it('should allow custom error messages', () => {
      const customMessage = 'Custom error message';
      const response = FusionResponse.badRequest(customMessage);
      
      expect(response.body).toEqual({ message: customMessage });
    });
  });

  describe('Header Methods', () => {
    it('should set single header with chaining', () => {
      const response = new FusionResponse()
        .header('X-Custom', 'value');
      
      expect(response.headers).toEqual({ 'X-Custom': 'value' });
    });

    it('should set multiple headers individually', () => {
      const response = new FusionResponse()
        .header('X-First', 'value1')
        .header('X-Second', 'value2');
      
      expect(response.headers).toEqual({
        'X-First': 'value1',
        'X-Second': 'value2'
      });
    });

    it('should set multiple headers at once', () => {
      const headers = {
        'X-API-Version': '1.0',
        'X-Request-ID': '123'
      };
      
      const response = new FusionResponse().setHeaders(headers);
      
      expect(response.headers).toEqual(headers);
    });

    it('should merge headers when using setHeaders', () => {
      const response = new FusionResponse()
        .header('X-Existing', 'value')
        .setHeaders({ 'X-New': 'new-value' });
      
      expect(response.headers).toEqual({
        'X-Existing': 'value',
        'X-New': 'new-value'
      });
    });
  });

  describe('Content Type Methods', () => {
    it('should set JSON content type and body', () => {
      const data = { message: 'hello' };
      const response = new FusionResponse().json(data);
      
      expect(response.body).toEqual(data);
      expect(response.headers['Content-Type']).toBe('application/json');
    });

    it('should set text content type and body', () => {
      const text = 'Hello World';
      const response = new FusionResponse().text(text);
      
      expect(response.body).toBe(text);
      expect(response.headers['Content-Type']).toBe('text/plain');
    });

    it('should set HTML content type and body', () => {
      const html = '<h1>Hello</h1>';
      const response = new FusionResponse().html(html);
      
      expect(response.body).toBe(html);
      expect(response.headers['Content-Type']).toBe('text/html');
    });
  });

  describe('CORS Methods', () => {
    it('should set default CORS headers', () => {
      const response = new FusionResponse().cors();
      
      expect(response.headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
    });

    it('should set custom CORS origins and methods', () => {
      const origins = ['https://example.com', 'https://app.com'];
      const methods = ['GET', 'POST'];
      const response = new FusionResponse().cors(origins, methods);
      
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://example.com, https://app.com');
      expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, POST');
    });
  });

  describe('Cache Methods', () => {
    it('should set cache control with max-age', () => {
      const response = new FusionResponse().cache(3600);
      
      expect(response.headers['Cache-Control']).toBe('max-age=3600');
    });

    it('should set no-cache headers', () => {
      const response = new FusionResponse().noCache();
      
      expect(response.headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    });
  });

  describe('Method Chaining', () => {
    it('should support method chaining', () => {
      const response = FusionResponse.created({ id: 1, name: 'test' })
        .header('Location', '/users/1')
        .cors(['https://example.com'])
        .cache(300);
      
      expect(response.statusCode).toBe(201);
      expect(response.body).toEqual({ id: 1, name: 'test' });
      expect(response.headers['Location']).toBe('/users/1');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(response.headers['Cache-Control']).toBe('max-age=300');
    });
  });

  describe('toResponse Method', () => {
    it('should return proper Lambda response format for JSON', () => {
      const data = { message: 'hello' };
      const response = FusionResponse.ok(data).toResponse();
      
      expect(response).toEqual({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    });

    it('should return proper Lambda response format for text', () => {
      const text = 'Hello World';
      const response = new FusionResponse().text(text).toResponse();
      
      expect(response).toEqual({
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: text
      });
    });

    it('should handle null body', () => {
      const response = new FusionResponse(null).toResponse();
      
      expect(response.body).toBe('');
    });

    it('should handle undefined body', () => {
      const response = new FusionResponse(undefined).toResponse();
      
      expect(response.body).toBe('');
    });

    it('should JSON.stringify non-string bodies', () => {
      const data = { test: true };
      const response = new FusionResponse(data).toResponse();
      
      expect(response.body).toBe(JSON.stringify(data));
      expect(response.headers['Content-Type']).toBe('application/json');
    });

    it('should preserve custom headers in final response', () => {
      const response = FusionResponse.ok({ data: 'test' })
        .header('X-Custom', 'value')
        .cors(['*'])
        .toResponse();
      
      expect(response.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Custom': 'value',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
    });
  });
});
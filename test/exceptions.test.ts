import {
  FusionException,
  ValidationException,
  ResourceNotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  TooManyRequestsException,
  InternalServerErrorException,
  BadGatewayException,
  ServiceUnavailableException
} from '../src';

describe('Exceptions', () => {
  describe('ValidationException', () => {
    it('should create exception with 400 status code', () => {
      const exception = new ValidationException('Invalid input');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception).toBeInstanceOf(Error);
      expect(exception.code).toBe(400);
      expect(exception.message).toBe('Invalid input');
    });

    it('should use default message when not provided', () => {
      const exception = new ValidationException();

      expect(exception.code).toBe(400);
      expect(exception.message).toBe('Bad Request');
    });
  });

  describe('UnauthorizedException', () => {
    it('should create exception with 401 status code', () => {
      const exception = new UnauthorizedException('Invalid credentials');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(401);
      expect(exception.message).toBe('Invalid credentials');
    });

    it('should use default message when not provided', () => {
      const exception = new UnauthorizedException();

      expect(exception.code).toBe(401);
      expect(exception.message).toBe('Unauthorized');
    });
  });

  describe('ForbiddenException', () => {
    it('should create exception with 403 status code', () => {
      const exception = new ForbiddenException('Access denied');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(403);
      expect(exception.message).toBe('Access denied');
    });

    it('should use default message when not provided', () => {
      const exception = new ForbiddenException();

      expect(exception.code).toBe(403);
      expect(exception.message).toBe('Forbidden');
    });
  });

  describe('ResourceNotFoundException', () => {
    it('should create exception with 404 status code', () => {
      const exception = new ResourceNotFoundException('User not found');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(404);
      expect(exception.message).toBe('User not found');
    });

    it('should use default message when not provided', () => {
      const exception = new ResourceNotFoundException();

      expect(exception.code).toBe(404);
      expect(exception.message).toBe('Not Found');
    });
  });

  describe('ConflictException', () => {
    it('should create exception with 409 status code', () => {
      const exception = new ConflictException('Email already exists');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(409);
      expect(exception.message).toBe('Email already exists');
    });

    it('should use default message when not provided', () => {
      const exception = new ConflictException();

      expect(exception.code).toBe(409);
      expect(exception.message).toBe('Conflict');
    });
  });

  describe('UnprocessableEntityException', () => {
    it('should create exception with 422 status code', () => {
      const exception = new UnprocessableEntityException('Semantic validation failed');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(422);
      expect(exception.message).toBe('Semantic validation failed');
    });

    it('should use default message when not provided', () => {
      const exception = new UnprocessableEntityException();

      expect(exception.code).toBe(422);
      expect(exception.message).toBe('Unprocessable Entity');
    });
  });

  describe('TooManyRequestsException', () => {
    it('should create exception with 429 status code', () => {
      const exception = new TooManyRequestsException('Rate limit exceeded');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(429);
      expect(exception.message).toBe('Rate limit exceeded');
    });

    it('should use default message when not provided', () => {
      const exception = new TooManyRequestsException();

      expect(exception.code).toBe(429);
      expect(exception.message).toBe('Too Many Requests');
    });
  });

  describe('InternalServerErrorException', () => {
    it('should create exception with 500 status code', () => {
      const exception = new InternalServerErrorException('Database connection failed');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(500);
      expect(exception.message).toBe('Database connection failed');
    });

    it('should use default message when not provided', () => {
      const exception = new InternalServerErrorException();

      expect(exception.code).toBe(500);
      expect(exception.message).toBe('Internal Server Error');
    });
  });

  describe('BadGatewayException', () => {
    it('should create exception with 502 status code', () => {
      const exception = new BadGatewayException('Upstream service error');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(502);
      expect(exception.message).toBe('Upstream service error');
    });

    it('should use default message when not provided', () => {
      const exception = new BadGatewayException();

      expect(exception.code).toBe(502);
      expect(exception.message).toBe('Bad Gateway');
    });
  });

  describe('ServiceUnavailableException', () => {
    it('should create exception with 503 status code', () => {
      const exception = new ServiceUnavailableException('Service is down for maintenance');

      expect(exception).toBeInstanceOf(FusionException);
      expect(exception.code).toBe(503);
      expect(exception.message).toBe('Service is down for maintenance');
    });

    it('should use default message when not provided', () => {
      const exception = new ServiceUnavailableException();

      expect(exception.code).toBe(503);
      expect(exception.message).toBe('Service Unavailable');
    });
  });

  describe('Exception inheritance', () => {
    it('should all extend FusionException', () => {
      const exceptions = [
        new ValidationException('test'),
        new UnauthorizedException('test'),
        new ForbiddenException('test'),
        new ResourceNotFoundException('test'),
        new ConflictException('test'),
        new UnprocessableEntityException('test'),
        new TooManyRequestsException('test'),
        new InternalServerErrorException('test'),
        new BadGatewayException('test'),
        new ServiceUnavailableException('test')
      ];

      exceptions.forEach(exception => {
        expect(exception).toBeInstanceOf(FusionException);
        expect(exception).toBeInstanceOf(Error);
        expect(exception.code).toBeGreaterThan(0);
        expect(exception.message).toBeTruthy();
      });
    });

    it('should have correct HTTP status codes', () => {
      expect(new ValidationException('test').code).toBe(400);
      expect(new UnauthorizedException('test').code).toBe(401);
      expect(new ForbiddenException('test').code).toBe(403);
      expect(new ResourceNotFoundException('test').code).toBe(404);
      expect(new ConflictException('test').code).toBe(409);
      expect(new UnprocessableEntityException('test').code).toBe(422);
      expect(new TooManyRequestsException('test').code).toBe(429);
      expect(new InternalServerErrorException('test').code).toBe(500);
      expect(new BadGatewayException('test').code).toBe(502);
      expect(new ServiceUnavailableException('test').code).toBe(503);
    });
  });

  describe('Exception usage in try-catch', () => {
    it('should be catchable as FusionException', () => {
      try {
        throw new UnauthorizedException('Not logged in');
      } catch (error) {
        expect(error).toBeInstanceOf(FusionException);
        if (error instanceof FusionException) {
          expect(error.code).toBe(401);
          expect(error.message).toBe('Not logged in');
        }
      }
    });

    it('should preserve stack trace', () => {
      const exception = new ConflictException('Duplicate entry');

      expect(exception.stack).toBeDefined();
      expect(exception.stack).toContain('ConflictException');
    });
  });
});

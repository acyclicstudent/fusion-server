# Fusion Framework Server

[![npm version](https://badge.fury.io/js/%40fusion-framework%2Fserver.svg)](https://badge.fury.io/js/%40fusion-framework%2Fserver)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, TypeScript-first framework for building serverless applications on AWS Lambda with clean architecture principles, dependency injection, and advanced response handling.

## ✨ Features

- 🏗️ **Clean Architecture** - Built-in use case pattern with proper separation of concerns
- 💉 **Dependency Injection** - Powered by TSyringe for testable, maintainable code
- 🎯 **Decorator-based** - Express-like decorators for controllers and HTTP methods
- 📡 **Event-driven** - Support for Lambda event listeners beyond HTTP
- 🔧 **Advanced Response Control** - Flexible response handling with headers, status codes, and CORS
- ⚡ **AWS Lambda Optimized** - Built specifically for serverless deployments
- 🧪 **Testing Ready** - Full TypeScript support with testing utilities
- 📦 **Zero Configuration** - Works out of the box with sensible defaults

## 📦 Installation

```bash
npm install @fusion-framework/server
# or
yarn add @fusion-framework/server
```

## 🚀 Quick Start

### 1. Create a Controller

```typescript
import { Controller, Get, Post, FusionResponse } from '@fusion-framework/server';
import { APIGatewayEvent } from 'aws-lambda';

@Controller('/users')
export class UserController {
  @Get('/list')
  async getUsers() {
    return { users: ['user1', 'user2'] }; // Auto JSON response
  }

  @Post('/')
  async createUser(event: APIGatewayEvent) {
    const userData = JSON.parse(event.body || '{}');
    const user = { id: 1, ...userData };
    
    // Advanced response with status and headers
    return FusionResponse.created(user)
      .header('Location', `/users/${user.id}`);
  }

  @Get('/:id')
  async getUser(event: APIGatewayEvent) {
    const user = await this.findUser(event.pathParameters?.id);
    
    if (!user) {
      return FusionResponse.notFound('User not found');
    }
    
    return FusionResponse.ok(user);
  }
}
```

### 2. Create a Lambda Handler

```typescript
import { app } from '@fusion-framework/server';
import { UserController } from './controllers/UserController';

export const handler = app.createHandler({
  controllers: [UserController]
});
```

### 3. Deploy and Use

Your Lambda function now handles HTTP requests with automatic routing based on your decorators!

## 🏗️ Clean Architecture with Use Cases

### Define a Use Case

```typescript
import { UseCase, UC } from '@fusion-framework/server';

export interface CreateUserRequest {
  name: string;
  email: string;
}

@UseCase()
export class CreateUserUC extends UC {
  async execute(request: CreateUserRequest) {
    // Business logic here
    const user = await this.userRepository.create(request);
    await this.emailService.sendWelcome(user.email);
    return user;
  }
}
```

### Use in Controller

```typescript
import { Controller, Post, UCExecutor } from '@fusion-framework/server';

@Controller('/users')
export class UserController {
  constructor(private ucExecutor: UCExecutor) {}

  @Post('/')
  async createUser(event: APIGatewayEvent) {
    const request = JSON.parse(event.body || '{}');
    
    try {
      const user = await this.ucExecutor.execute(CreateUserUC, request);
      return FusionResponse.created(user);
    } catch (error) {
      return FusionResponse.badRequest(error.message);
    }
  }
}
```

## 🎛️ Advanced Response Handling

### FusionResponse API

```typescript
// Status codes with chaining
return FusionResponse.ok(data)
  .header('X-Custom-Header', 'value')
  .cache(3600); // Cache for 1 hour

// Multiple headers at once
return new FusionResponse(data)
  .status(201)
  .setHeaders({
    'X-API-Version': '1.0',
    'X-Request-ID': requestId
  });

// CORS support
return FusionResponse.ok(data)
  .cors(['https://example.com'], ['GET', 'POST']);

// Different content types
return FusionResponse.ok()
  .text('Hello World');           // text/plain
  .html('<h1>Hello</h1>');       // text/html
  .json({ message: 'Hello' });   // application/json

// Convenience methods
return FusionResponse.created(user);        // 201
return FusionResponse.accepted(data);       // 202
return FusionResponse.noContent();          // 204
return FusionResponse.badRequest('Invalid'); // 400
return FusionResponse.unauthorized();       // 401
return FusionResponse.forbidden();          // 403
return FusionResponse.notFound();           // 404
return FusionResponse.conflict();           // 409
return FusionResponse.internalServerError(); // 500
```

### Backward Compatibility

```typescript
// These still work exactly as before:
@Get('/simple')
async getSimpleData() {
  return { message: 'Hello' }; // Auto JSON with 200 status
}

@Delete('/cleanup')
async cleanup() {
  // cleanup logic...
  return; // Auto 204 No Content
}
```

## 📡 Event Listeners

Handle non-HTTP Lambda events:

```typescript
import { Listener, EvtListener } from '@fusion-framework/server';

@Listener('user.created')
export class UserCreatedListener implements EvtListener {
  async handle(event: any) {
    console.log('User created:', event.data);
    // Send welcome email, update analytics, etc.
    return { processed: true };
  }
}

// Register with handler
export const handler = app.createHandler({
  controllers: [UserController],
  listeners: [UserCreatedListener]
});
```

## 🧪 Testing

```typescript
import { container } from '@fusion-framework/server';
import { CreateUserUC } from '../use-cases/CreateUserUC';

describe('CreateUserUC', () => {
  beforeEach(() => {
    container.clearInstances();
  });

  it('should create user successfully', async () => {
    // Mock dependencies
    const mockRepo = { create: jest.fn().mockResolvedValue({ id: 1 }) };
    container.register('UserRepository', { useValue: mockRepo });

    const useCase = container.resolve(CreateUserUC);
    const result = await useCase.execute({ name: 'John', email: 'john@example.com' });

    expect(result.id).toBe(1);
    expect(mockRepo.create).toHaveBeenCalled();
  });
});
```

## 📋 Complete Example

```typescript
// user.controller.ts
import { 
  Controller, Get, Post, Put, Delete,
  FusionResponse, UCExecutor, Stage
} from '@fusion-framework/server';

@Controller('/users')
export class UserController {
  constructor(
    private ucExecutor: UCExecutor,
    @Stage() private stage: string
  ) {}

  @Get('/')
  async listUsers(event: APIGatewayEvent) {
    const users = await this.ucExecutor.execute(ListUsersUC);
    
    return FusionResponse.ok(users)
      .cors(['*'])
      .cache(this.stage === 'prod' ? 300 : 0);
  }

  @Post('/')
  async createUser(event: APIGatewayEvent) {
    try {
      const userData = JSON.parse(event.body || '{}');
      const user = await this.ucExecutor.execute(CreateUserUC, userData);
      
      return FusionResponse.created(user)
        .header('Location', `/users/${user.id}`)
        .cors(['*']);
        
    } catch (error) {
      if (error instanceof ValidationException) {
        return FusionResponse.badRequest(error.message);
      }
      throw error; // Let framework handle 500 errors
    }
  }

  @Put('/:id')
  async updateUser(event: APIGatewayEvent) {
    const id = event.pathParameters?.id;
    const updates = JSON.parse(event.body || '{}');
    
    try {
      const user = await this.ucExecutor.execute(UpdateUserUC, id, updates);
      return FusionResponse.ok(user);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        return FusionResponse.notFound('User not found');
      }
      throw error;
    }
  }

  @Delete('/:id')
  async deleteUser(event: APIGatewayEvent) {
    const id = event.pathParameters?.id;
    await this.ucExecutor.execute(DeleteUserUC, id);
    return FusionResponse.noContent();
  }
}

// handler.ts
import { app } from '@fusion-framework/server';
import { UserController } from './controllers/user.controller';
import { EmailListener } from './listeners/email.listener';

export const handler = app.createHandler({
  controllers: [UserController],
  listeners: [EmailListener]
});
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development mode (watch)
npm start

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Analyze bundle
npm run analyze
```

## 📝 API Reference

### Decorators

- `@Controller(path)` - Define a controller with base path
- `@Get(path)` - Handle GET requests
- `@Post(path)` - Handle POST requests  
- `@Put(path)` - Handle PUT requests
- `@Delete(path)` - Handle DELETE requests
- `@Patch(path)` - Handle PATCH requests
- `@UseCase()` - Mark a class as a use case
- `@Injectable()` - Mark a class as injectable service
- `@Listener(event)` - Handle custom events
- `@Stage()` - Inject deployment stage
- `@Inject(token)` - Explicit dependency injection

### Classes

- `FusionResponse` - Advanced response builder with chaining
- `UC` - Base class for use cases
- `UCExecutor` - Execute use cases with DI
- `FusionException` - Base exception with HTTP status codes
- `ValidationException` - 400 Bad Request exception
- `ResourceNotFoundException` - 404 Not Found exception

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- 📖 [Documentation](./examples/)
- 🐛 [Issue Tracker](https://github.com/your-org/fusion-framework-server/issues)
- 💬 [Discussions](https://github.com/your-org/fusion-framework-server/discussions)

---

**Built with ❤️ for the serverless community**
# Fusion Framework Server

[![npm version](https://badge.fury.io/js/%40fusion-framework%2Fserver.svg)](https://badge.fury.io/js/%40fusion-framework%2Fserver)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, TypeScript-first framework for building serverless applications on AWS Lambda with clean architecture principles, dependency injection, and advanced response handling.

> **Using an LLM assistant?** Start with [`llms.txt`](./llms.txt) (curated index)
> or [`llms-full.txt`](./llms-full.txt) (complete reference). Those files are
> the authoritative source for conventions like path syntax (`{id}` not `:id`)
> and the use-case / permission patterns.

## ✨ Features

- 🏗️ **Clean Architecture** - Built-in use case pattern with proper separation of concerns
- 💉 **Dependency Injection** - Powered by TSyringe for testable, maintainable code
- 🎯 **Decorator-based** - Express-like decorators for controllers and HTTP methods
- 📡 **Event-driven** - Support for Lambda event listeners beyond HTTP
- 🔧 **Advanced Response Control** - Flexible response handling with headers, status codes, and CORS
- 📄 **Binary File Support** - Built-in base64 encoding for serving images, PDFs, and other binary files
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

  @Get('/{id}')
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
import { Controller, Post, FusionResponse, UCExecutor, Executor } from '@fusion-framework/server';

@Controller('/users')
export class UserController {
  // @Executor() is the idiomatic way to inject UCExecutor.
  // Never inject a UC directly — always run it through UCExecutor.
  constructor(@Executor() private ucExecutor: UCExecutor) {}

  @Post('/')
  async createUser(event: APIGatewayEvent) {
    const request = JSON.parse(event.body || '{}');

    // No need to wrap in try/catch — any FusionException thrown inside
    // the use case (ValidationException, ConflictException, etc.) is
    // caught by the framework and mapped to its `.code` status.
    const user = await this.ucExecutor.execute(CreateUserUC, request);
    return FusionResponse.created(user);
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

// Different content types (each one sets the body and Content-Type)
return new FusionResponse().text('Hello World');       // text/plain
return new FusionResponse().html('<h1>Hello</h1>');    // text/html
return new FusionResponse().json({ message: 'Hello' }); // application/json

// Binary files (base64 encoded)
return FusionResponse.pdf(base64PdfData);
return FusionResponse.image(base64ImageData, 'png');
return FusionResponse.file(base64Data, 'application/zip', 'archive.zip');

// Manual base64 encoding
return new FusionResponse(base64Data)
  .base64()
  .header('Content-Type', 'application/octet-stream');

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

Handle non-HTTP Lambda events (SQS, S3, EventBridge, Cognito triggers,
Bedrock hooks, custom invocations, etc.). Two dispatch strategies.

### 1. Event-name listeners (O(1) lookup)

Use when the event payload contains an `event` key you control — e.g.
internal pub/sub or direct Lambda invocations.

```typescript
import { Listener, EvtListener } from '@fusion-framework/server';

@Listener('user.created')
export class UserCreatedListener implements EvtListener {
  async handle(evt: { event: 'user.created'; data: { userId: string } }) {
    // ...
    return { processed: true };
  }
}

// Invoke with: { event: 'user.created', data: { userId: '1' } }
```

### 2. Pattern-matched listeners (for events you don't control)

Use when events come from AWS services (SQS, S3, EventBridge, …) where
you match on structural fields. The first registered pattern that matches
wins. Patterns use dot-notation + bracket indexing into the event.

```typescript
import { Listener, EvtListener } from '@fusion-framework/server';

// SQS trigger on a specific queue
@Listener({
  patterns: {
    'Records[0].eventSource': 'aws:sqs',
    'Records[0].eventSourceARN': /:my-queue$/,   // RegExp supported
  },
})
export class MyQueueListener implements EvtListener {
  async handle(evt: any) {
    for (const record of evt.Records) { /* ... */ }
    return { processed: evt.Records.length };
  }
}

// S3 object created
@Listener({
  patterns: {
    'Records[0].eventSource': 'aws:s3',
    'Records[0].eventName': /^ObjectCreated:/,
  },
})
export class S3UploadListener implements EvtListener { /* ... */ }

// Cognito pre-token generation trigger
@Listener({
  patterns: { triggerSource: 'TokenGeneration_Authentication' },
})
export class CognitoPreTokenListener implements EvtListener { /* ... */ }
```

Pattern values can be:

- **String** — equality match
- **RegExp** — regex test against the string at that path
- **Function** `(value) => boolean` — custom predicate

All patterns in the `patterns` object must match for the listener to fire.

### Registration

```typescript
export const handler = app.createHandler({
  controllers: [UserController],
  listeners: [UserCreatedListener, MyQueueListener, S3UploadListener],
});
```

### Listener return shape

How a listener's return value is converted into the Lambda response
depends on what it returns:

| Listener returns | Wrapped Lambda response |
|---|---|
| `FusionResponse` with custom headers **or** non-200 status | Full API Gateway shape: `{ statusCode, headers, body, isBase64Encoded? }` |
| `FusionResponse` with default 200 + no custom headers | Raw body only (`.toObject()`) — for callers that expect a plain object back (Cognito triggers, Bedrock hooks, step functions, …) |
| Any other value (object, string, number, void) | `{ success: true, matchType, body: <your return value> }` where `matchType` is `'eventName'` or `'pattern'` |
| Throws | `{ success: false, body: { message, event } }` — errors are caught and logged, never rethrown |

**Practical guidance:**

- **Cognito / Bedrock / EventBridge targets** expect a specific object
  shape back. Return a `FusionResponse` with that shape and no status
  change — Fusion will unwrap it so the AWS service receives the raw
  object:
  ```typescript
  @Listener({ patterns: { triggerSource: 'TokenGeneration_Authentication' } })
  async handle(evt) {
    evt.response = { claimsOverrideDetails: { ... } };
    return FusionResponse.ok(evt);  // AWS Cognito receives `evt` directly
  }
  ```
- **SQS / S3 / EventBridge ingestion** (no response expected) — return
  a plain summary object. It will be wrapped as `{ success, matchType, body }`,
  useful for CloudWatch logs but irrelevant to the source service.
- **If you need an API-Gateway-like HTTP response from a listener** (rare,
  but possible when an internal service invokes the Lambda expecting HTTP
  shape), return a `FusionResponse` with a non-200 status OR with custom
  headers — Fusion then emits the full API Gateway response format.

### Dispatch order

For an incoming event, Fusion checks in order:

1. `evt.event` (string) exists AND matches a `@Listener(eventName)` → dispatch (O(1)).
2. Otherwise, iterate registered pattern listeners; first full match wins.
3. No match → error response with the event keys for debugging.

## 🚨 Exception Handling

The framework provides built-in HTTP exceptions for common error scenarios:

```typescript
import {
  ValidationException,
  UnauthorizedException,
  ForbiddenException,
  ResourceNotFoundException,
  ConflictException,
  UnprocessableEntityException,
  TooManyRequestsException,
  InternalServerErrorException,
  BadGatewayException,
  ServiceUnavailableException
} from '@fusion-framework/server';

@Controller('/api')
export class ApiController {
  @Post('/login')
  async login(event: APIGatewayEvent) {
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      throw new ValidationException('Email and password are required');
    }

    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return FusionResponse.ok({ token: user.token });
  }

  @Get('/admin/users')
  async getAdminUsers(event: APIGatewayEvent) {
    const user = await this.authService.validateToken(event);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return FusionResponse.ok(await this.userService.getAllUsers());
  }

  @Post('/users')
  async createUser(event: APIGatewayEvent) {
    const userData = JSON.parse(event.body || '{}');

    const existingUser = await this.userService.findByEmail(userData.email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.userService.create(userData);
    return FusionResponse.created(user);
  }

  @Post('/process')
  async processData(event: APIGatewayEvent) {
    const data = JSON.parse(event.body || '{}');

    // Validation passed, but business rules failed
    if (data.age < 18 && data.requiresParentalConsent === false) {
      throw new UnprocessableEntityException('Parental consent required for minors');
    }

    return FusionResponse.ok(await this.processService.process(data));
  }

  @Get('/data')
  async getData(event: APIGatewayEvent) {
    const userId = event.requestContext.authorizer?.userId;

    if (await this.rateLimiter.isRateLimited(userId)) {
      throw new TooManyRequestsException('Rate limit exceeded. Try again in 1 minute');
    }

    return FusionResponse.ok(await this.dataService.getData());
  }

  @Get('/proxy/{service}')
  async proxyService(event: APIGatewayEvent) {
    const service = event.pathParameters?.service;

    try {
      const response = await this.httpClient.get(`https://api.${service}.com/data`);
      return FusionResponse.ok(response.data);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new BadGatewayException(`Unable to connect to ${service} service`);
      }
      throw error;
    }
  }

  @Get('/health')
  async healthCheck() {
    const isDbConnected = await this.db.ping();

    if (!isDbConnected) {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return FusionResponse.ok({ status: 'healthy' });
  }
}
```

### Creating Custom Exceptions

```typescript
import { FusionException } from '@fusion-framework/server';

// Custom exception with specific HTTP code
export class PaymentRequiredException extends FusionException {
  constructor(message: string = 'Payment Required') {
    super(402, message);
  }
}

// Usage
@Post('/premium-feature')
async accessPremiumFeature(event: APIGatewayEvent) {
  const user = await this.authService.getCurrentUser(event);

  if (!user.isPremium) {
    throw new PaymentRequiredException('Upgrade to premium to access this feature');
  }

  return FusionResponse.ok({ data: 'Premium content' });
}
```

## 🔒 Permissions & Auth

Declarative permission checks via decorator. The framework does not
assume where permissions come from in the event — you register a
resolver that knows your auth setup (Cognito claims, custom Lambda
authorizer context, signed header, DB lookup, etc.).

### Enforcing permissions on a route

```typescript
import {
  Controller, Get, Post, FusionResponse,
  RequirePermission, ResolveAuth, getAuthContext,
} from '@fusion-framework/server';

@Controller('/operations')
export class OperationsController {
  @Get('/{id}')
  @RequirePermission('operations:read:own')   // all mode (default)
  async getOne(event: APIGatewayEvent) {
    const auth = getAuthContext(event);        // attached by decorator
    return FusionResponse.ok({ id: event.pathParameters!.id, userId: auth?.userId });
  }

  @Post('/{id}/assign')
  @RequirePermission('admin:*', 'operations:assign:area', { mode: 'any' })
  async assign(event: APIGatewayEvent) { /* ... */ }

  @Get('/public')
  @ResolveAuth()   // attach auth context if present, don't enforce
  async publicFeed(event: APIGatewayEvent) {
    const auth = getAuthContext(event);
    return auth ? personalizedFeed(auth.userId) : anonymousFeed();
  }
}
```

### Permission syntax

Colon-separated tokens (`resource:action:scope`) with per-segment
wildcards:

- `operations:read:own` — read own operations
- `operations:*:area` — any action on operations in caller's area
- `*` in `granted` — matches anything

`mode: 'all'` (default) requires every listed permission; `mode: 'any'`
requires at least one. Denied responses return a 403 `FusionResponse`
with `{ message: 'Forbidden', required, mode }`. Customize via
`onDenied`:

```typescript
@RequirePermission('ops:delete:*', {
  onDenied: ({ required }) =>
    new FusionResponse({ code: 'NO_PERM', required }).status(403),
})
```

### Registering an auth resolver

Register during bootstrap, before `app.createHandler(...)`:

```typescript
import {
  container, AUTH_CONTEXT_RESOLVER, IAuthContextResolver, AuthContext,
} from '@fusion-framework/server';
import { APIGatewayEvent } from 'aws-lambda';

class MyCustomAuthResolver implements IAuthContextResolver {
  resolve(event: APIGatewayEvent): AuthContext {
    const auth = (event.requestContext as any)?.authorizer ?? {};
    return {
      userId: auth.userId,
      permissions: (auth.permissions ?? '').split(',').filter(Boolean),
      roles: JSON.parse(auth.roles ?? '[]'),
      areas: JSON.parse(auth.areas ?? '[]'),
    };
  }
}

container.register(AUTH_CONTEXT_RESOLVER, { useClass: MyCustomAuthResolver });
```

If no resolver is registered, a default falls back to reading
Cognito-style claims from `event.requestContext.authorizer.claims` (or
`.jwt.claims` for HTTP API v2). Resolvers can be async; the decorator
awaits them.

## 🧪 Testing

```typescript
import 'reflect-metadata';
import { container, UCExecutor } from '@fusion-framework/server';
import { CreateUserUC } from '../use-cases/CreateUserUC';

describe('CreateUserUC', () => {
  afterEach(() => container.reset());

  it('should create user successfully', async () => {
    // Mock dependencies
    const mockRepo = { create: jest.fn().mockResolvedValue({ id: 1 }) };
    container.register('UserRepository', { useValue: mockRepo });

    // Run through UCExecutor — the same entry point controllers use.
    // Never call `container.resolve(CreateUserUC).execute(...)` directly;
    // UCs are always executed via UCExecutor.
    const executor = new UCExecutor();
    const result = await executor.execute(CreateUserUC, {
      name: 'John',
      email: 'john@example.com',
    });

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
  FusionResponse, UCExecutor, Executor, Stage,
  RequirePermission,
} from '@fusion-framework/server';

@Controller('/users')
export class UserController {
  constructor(
    @Executor() private ucExecutor: UCExecutor,
    @Stage() private stage: string
  ) {}

  // No try/catch needed — any FusionException thrown by a use case
  // (Validation, Conflict, ResourceNotFound, …) is caught by the
  // framework and mapped to its `.code` status automatically.

  @Get('/')
  @RequirePermission('users:read:*')
  async listUsers(event: APIGatewayEvent) {
    const users = await this.ucExecutor.execute(ListUsersUC);
    return FusionResponse.ok(users)
      .cache(this.stage === 'prod' ? 300 : 0);
  }

  @Post('/')
  @RequirePermission('users:create:*')
  async createUser(event: APIGatewayEvent) {
    const userData = JSON.parse(event.body || '{}');
    const user = await this.ucExecutor.execute(CreateUserUC, userData);
    return FusionResponse.created(user)
      .header('Location', `/users/${user.id}`);
  }

  @Put('/{id}')
  @RequirePermission('users:update:*')
  async updateUser(event: APIGatewayEvent) {
    const id = event.pathParameters?.id;
    const updates = JSON.parse(event.body || '{}');
    const user = await this.ucExecutor.execute(UpdateUserUC, id, updates);
    return FusionResponse.ok(user);
  }

  @Delete('/{id}')
  async deleteUser(event: APIGatewayEvent) {
    const id = event.pathParameters?.id;
    await this.ucExecutor.execute(DeleteUserUC, id);
    return FusionResponse.noContent();
  }

  @Get('/{id}/avatar')
  async getUserAvatar(event: APIGatewayEvent) {
    const id = event.pathParameters?.id;
    const avatar = await this.ucExecutor.execute(GetUserAvatarUC, id);

    // Return binary image data (base64 encoded)
    return FusionResponse.image(avatar.base64Data, 'png')
      .cache(3600)
      .cors(['*']);
  }

  @Get('/{id}/report')
  async getUserReport(event: APIGatewayEvent) {
    const id = event.pathParameters?.id;
    const pdfData = await this.ucExecutor.execute(GenerateUserReportUC, id);

    // Return PDF file with download filename
    return FusionResponse.file(pdfData, 'application/pdf', `user-${id}-report.pdf`);
  }
}

// handler.ts
import 'reflect-metadata';   // must be imported first, once
import {
  app, container, AUTH_CONTEXT_RESOLVER,
} from '@fusion-framework/server';
import { UserController } from './controllers/user.controller';
import { EmailListener } from './listeners/email.listener';
import { MyCustomAuthResolver } from './auth/resolver';

// Register custom auth resolver BEFORE createHandler so @RequirePermission
// picks it up. Without this, the default Cognito-claims resolver is used.
container.register(AUTH_CONTEXT_RESOLVER, { useClass: MyCustomAuthResolver });

export const handler = app.createHandler({
  controllers: [UserController],
  listeners: [EmailListener],
  cors: {
    enabled: true,
    allowOrigins: ['https://app.example.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600,
  },
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

- `@Controller(path)` — Define a controller with base path. Use `{id}`
  for path params, not `:id`.
- `@Get(path)` / `@Post(path)` / `@Put(path)` / `@Patch(path)` / `@Delete(path)` — HTTP method handlers.
- `@UseCase()` — Mark a class as a use case (extends `UC`, executed via `UCExecutor`).
- `@Injectable(token?)` — Mark a class as an injectable service.
- `@Listener(eventNameOrConfig)` — Event-name or pattern-matched listener.
- `@Stage()` — Param decorator: inject deployment stage (`dev`/`qa`/`staging`/`prod`).
- `@Executor()` — Param decorator: inject `UCExecutor`.
- `@Inject(token)` — Explicit dependency injection by token.
- `@RequirePermission(...perms, options?)` — Enforce permissions on a method.
- `@ResolveAuth()` — Attach `AuthContext` to event without enforcing perms.

### Classes

- `FusionResponse` - Advanced response builder with chaining
- `UC` - Base class for use cases
- `UCExecutor` - Execute use cases with DI
- `FusionException` - Base exception with HTTP status codes
- `ValidationException` - 400 Bad Request exception
- `UnauthorizedException` - 401 Unauthorized exception
- `ForbiddenException` - 403 Forbidden exception
- `ResourceNotFoundException` - 404 Not Found exception
- `ConflictException` - 409 Conflict exception
- `UnprocessableEntityException` - 422 Unprocessable Entity exception
- `TooManyRequestsException` - 429 Too Many Requests exception
- `InternalServerErrorException` - 500 Internal Server Error exception
- `BadGatewayException` - 502 Bad Gateway exception
- `ServiceUnavailableException` - 503 Service Unavailable exception

### Auth / Permissions

- `AuthContext` — shape of the resolved auth (userId, permissions[], roles[], areas[], raw).
- `IAuthContextResolver` — interface projects implement to extract auth from events.
- `AUTH_CONTEXT_RESOLVER` — tsyringe token for registering the resolver.
- `DefaultCognitoAuthResolver` — fallback resolver (Cognito claims).
- `getAuthContext(event)` — read the auth context a decorator attached to the event.
- `hasPermission(granted, required)` / `hasAllPermissions` / `hasAnyPermission` — matching utilities with segment wildcards.

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
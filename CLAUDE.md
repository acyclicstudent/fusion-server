# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **@fusion-framework/server** - a TypeScript library for building AWS Lambda serverless applications with a clean architecture approach. The framework is built on top of TSDX and uses dependency injection via TSyringe.

## Commands

### Development
- `npm start` or `yarn start` - Build to `/dist` and run in watch mode
- `npm run build` or `yarn build` - One-off build
- `npm test` or `yarn test` - Run Jest tests
- `npm run lint` or `yarn lint` - Lint code with TSDX linter

### Analysis
- `npm run size` - Calculate bundle size with size-limit
- `npm run analyze` - Visualize bundle with size-limit

## Architecture

### Clean Architecture with Fusion Framework

The framework implements Clean Architecture patterns with specific conventions:

**Use Cases:**
- All use cases must be decorated with `@UseCase()` (not `@Injectable()`)
- Use cases must extend the `UC` abstract class
- Use cases are called via `UCExecutor` instead of direct constructor injection
- Example pattern:
  ```ts
  @UseCase()
  class MyUseCase extends UC {
    execute(param: string): string {
      // implementation
    }
  }
  
  // Usage:
  const executor = new UCExecutor();
  executor.execute(MyUseCase, "param");
  ```

### Core Components

**Controllers:**
- Decorated with `@Controller(route: string)`
- HTTP methods decorated with `@Get()`, `@Post()`, `@Put()`, `@Delete()`, `@Patch()`
- Automatically registered for AWS Lambda API Gateway integration

**Listeners:**
- Decorated with `@Listener(event: string)` for event-driven architecture
- Must implement `EvtListener` interface with `handle()` method

**Dependency Injection:**
- Uses TSyringe container
- `@Injectable()` for regular services
- `@UseCase()` for use cases
- `@Stage()` parameter decorator for deployment stage injection
- `@Inject()` for explicit dependency injection

**Exception Handling:**
- Extend `FusionException` for custom exceptions with HTTP status codes
- Built-in exceptions: `ValidationException`, `ResourceNotFoundException`

**Response Handling:**
- Controllers can return plain objects (auto JSON with 200 status) for backward compatibility
- Return `null`/`undefined` for automatic 204 No Content responses
- Use `FusionResponse` class for advanced response control:
  ```ts
  // Basic usage with chaining
  return FusionResponse.ok(data)
    .header('X-Custom', 'value')
    .cors(['https://example.com']);

  // Status codes and convenience methods
  return FusionResponse.created(user);
  return FusionResponse.notFound('User not found');
  return FusionResponse.badRequest('Invalid input');

  // Custom responses
  return new FusionResponse(data)
    .status(201)
    .header('Location', `/users/${id}`)
    .cache(3600);
  ```

### Project Structure

```
src/
├── core/
│   ├── classes/          # UC base class, UCExecutor, and FusionResponse
│   ├── decorators/       # Framework decorators
│   │   ├── dependencies/ # DI decorators
│   │   ├── http/         # HTTP method decorators
│   │   ├── interfaces/   # Controller and Listener decorators
│   │   └── stages/       # Stage decorator
│   ├── exceptions/       # Custom exception classes
│   └── interfaces/       # Core interfaces
├── fusion-server.ts      # Main FusionServer class
└── index.ts             # Library entry point
```

### Lambda Handler Creation

Use `FusionServer.createHandler()` to create AWS Lambda handlers:

```ts
import { app } from '@fusion-framework/server';

export const handler = app.createHandler({
  controllers: [UserController, ProductController],
  dependencies: [UserService], // Optional
  listeners: [EmailListener]   // Optional
});
```

## Testing

- Jest is configured and ready to use
- Run tests with `npm test`
- Test files should be in `/test` directory with `.test.ts` extension
- The framework exports `container` from TSyringe for mocking in unit tests

## Build Output

- Main: `dist/index.js` (CJS)
- Module: `dist/server.esm.js` (ESM) 
- Typings: `dist/index.d.ts`
- Bundle size limit: 10 KB for both CJS and ESM outputs
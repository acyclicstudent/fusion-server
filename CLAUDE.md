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
- Decorated with `@Listener(config)` for event-driven architecture
- Must implement `EvtListener` interface with `handle()` method
- Supports two routing modes:
  1. **Event-name routing** (backward compatible):
     ```ts
     @Listener('user.created')
     class UserListener implements EvtListener {
       async handle(evt: any) {
         // Handle event with evt.event === 'user.created'
       }
     }
     ```
  2. **Pattern matching** (for AWS service events):
     ```ts
     @Listener({
       match: {
         'Records[0].eventSource': 'aws:s3',
         'Records[0].eventName': 'ObjectCreated:*',
         'Records[0].s3.bucket.name': 'my-bucket'
       }
     })
     class S3Listener implements EvtListener {
       async handle(evt: any) {
         // Handle S3 ObjectCreated events for my-bucket
       }
     }
     ```

**Listener Pattern Matching:**
- Use dot notation paths to access nested properties: `'Records[0].s3.bucket.name'`
- Pattern types:
  - `'exact-value'` - Exact string match
  - `'prefix:*'` - Wildcard suffix matching (e.g., `'ObjectCreated:*'`)
  - `'*'` - Existence check (matches any non-null value)
  - `['value1', 'value2']` - OR logic (matches if value equals any array element)
- All patterns in a listener must match (AND logic)
- Priority rules:
  - Event-name takes absolute priority if `evt.event` exists
  - First registered pattern listener wins if multiple patterns match
  - Events without `httpMethod`/`resource` are routed to listener system

**Listener Response Handling:**
- **Plain objects**: Wrapped in `{success, matchType, body}` for backward compatibility
- **FusionResponse**: Smart detection based on configuration:
  - If only body is set (no custom headers/status) → Returns raw object (for Bedrock, Cognito, etc.)
  - If custom headers or status are set → Returns API Gateway format `{statusCode, headers, body}`
- This allows the same FusionResponse class to work for both direct Lambda invocations and HTTP-like responses

**Examples:**

*Direct object response (Bedrock, Cognito):*
```ts
@Listener({
  match: {
    'actionGroup': '*',
    'apiPath': '/my-action'
  }
})
class BedrockActionListener implements EvtListener {
  async handle(evt: any) {
    // FusionResponse with only body → returns raw object
    return new FusionResponse({
      messageVersion: '1.0',
      response: {
        actionGroup: evt.actionGroup,
        apiPath: evt.apiPath,
        httpStatusCode: 200,
        responseBody: {
          'application/json': {
            body: JSON.stringify({ result: 'processed' })
          }
        }
      }
    });
  }
}
```

*HTTP-like response (custom headers/status):*
```ts
@Listener('webhook.received')
class WebhookListener implements EvtListener {
  async handle(evt: any) {
    // FusionResponse with headers/status → returns API Gateway format
    return new FusionResponse({ processed: true })
      .status(202)
      .header('X-Request-ID', evt.requestId);
  }
}
```

**Common AWS Event Patterns:**
- **S3 Events:**
  ```ts
  @Listener({
    match: {
      'Records[0].eventSource': 'aws:s3',
      'Records[0].eventName': 'ObjectCreated:*'
    }
  })
  ```
- **SQS Events:**
  ```ts
  @Listener({
    match: {
      'Records[0].eventSource': 'aws:sqs'
    }
  })
  ```
- **EventBridge Events:**
  ```ts
  @Listener({
    match: {
      'source': 'aws.ec2',
      'detail-type': 'EC2 Instance State-change Notification'
    }
  })
  ```
- **Bedrock Agent Actions (with custom response):**
  ```ts
  @Listener({
    match: {
      'actionGroup': '*',
      'apiPath': '/process-data'
    }
  })
  class BedrockActionListener implements EvtListener {
    async handle(evt: any) {
      // Process the action
      const result = processData(evt.parameters);

      // Return Bedrock-specific response structure
      return new FusionResponse({
        messageVersion: '1.0',
        response: {
          actionGroup: evt.actionGroup,
          apiPath: evt.apiPath,
          httpMethod: evt.httpMethod,
          httpStatusCode: 200,
          responseBody: {
            'application/json': {
              body: JSON.stringify(result)
            }
          }
        }
      });
    }
  }
  ```
- **Cognito Pre-Token Generation:**
  ```ts
  @Listener({
    match: {
      'triggerSource': 'TokenGeneration_Authentication'
    }
  })
  class CognitoTokenListener implements EvtListener {
    async handle(evt: any) {
      // Add custom claims
      return new FusionResponse({
        claimsOverrideDetails: {
          claimsToAddOrOverride: {
            'custom:role': 'admin',
            'custom:tenant': evt.request.userAttributes['custom:tenant']
          },
          claimsToSuppress: []
        }
      });
    }
  }
  ```
- **Multi-source Listener:**
  ```ts
  @Listener({
    match: {
      'Records[0].eventSource': ['aws:s3', 'aws:sqs', 'aws:sns']
    }
  })
  ```

**Dependency Injection:**
- Uses TSyringe container
- `@Injectable()` for regular services
- `@UseCase()` for use cases
- `@Stage()` parameter decorator for deployment stage injection
- `@Inject()` for explicit dependency injection

**Exception Handling:**
- Extend `FusionException` for custom exceptions with HTTP status codes
- Built-in exceptions:
  - `ValidationException` (400) - Input validation errors
  - `UnauthorizedException` (401) - Authentication required
  - `ForbiddenException` (403) - Insufficient permissions
  - `ResourceNotFoundException` (404) - Resource not found
  - `ConflictException` (409) - Resource conflicts
  - `UnprocessableEntityException` (422) - Semantic validation errors
  - `TooManyRequestsException` (429) - Rate limiting
  - `InternalServerErrorException` (500) - Internal server errors
  - `BadGatewayException` (502) - Gateway/proxy errors
  - `ServiceUnavailableException` (503) - Service temporarily unavailable

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

  // Binary file responses (base64 encoded)
  return FusionResponse.pdf(base64PdfData);
  return FusionResponse.image(base64ImageData, 'png');
  return FusionResponse.file(base64Data, 'application/zip', 'archive.zip');

  // Manual base64 encoding
  return new FusionResponse(base64Data)
    .base64()
    .header('Content-Type', 'application/octet-stream');
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
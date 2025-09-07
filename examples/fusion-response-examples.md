# FusionResponse Examples

Los controladores del Fusion Framework ahora soportan múltiples formas de devolver respuestas:

## 1. Comportamiento Original (Backward Compatible)
```typescript
@Controller('/users')
class UserController {
  @Get('/list')
  async getUsers() {
    return { users: [...] }; // Auto JSON con status 200
  }

  @Delete('/cleanup')
  async cleanup() {
    // cleaning logic...
    // No devuelve nada = 204 No Content automático
  }
}
```

## 2. FusionResponse con Chaining

### Respuestas básicas
```typescript
import { FusionResponse } from '@fusion-framework/server';

@Controller('/api')
class ApiController {
  @Post('/users')
  async createUser(event: APIGatewayEvent) {
    const user = await this.createUserLogic();
    
    return new FusionResponse(user)
      .status(201)
      .header('Location', `/users/${user.id}`);
  }

  @Get('/profile')
  async getProfile() {
    return new FusionResponse({ profile: 'data' })
      .header('X-Custom-Header', 'value')
      .cache(3600); // Cache por 1 hora
  }
}
```

### Métodos de conveniencia
```typescript
@Controller('/posts')
class PostController {
  @Get('/:id')
  async getPost(event: APIGatewayEvent) {
    const post = await this.findPost(event.pathParameters?.id);
    
    if (!post) {
      return FusionResponse.notFound('Post not found');
    }
    
    return FusionResponse.ok(post);
  }

  @Post('/')
  async createPost(event: APIGatewayEvent) {
    try {
      const post = await this.createPostLogic();
      return FusionResponse.created(post);
    } catch (error) {
      return FusionResponse.badRequest(error.message);
    }
  }

  @Delete('/:id')
  async deletePost(event: APIGatewayEvent) {
    await this.deletePostLogic(event.pathParameters?.id);
    return FusionResponse.noContent();
  }
}
```

### Headers y CORS
```typescript
@Controller('/api')
class CorsController {
  @Get('/public-data')
  async getPublicData() {
    return FusionResponse.ok({ data: 'public' })
      .cors(['https://example.com', 'https://app.com'])
      .header('X-API-Version', '1.0');
  }

  @Options('/upload')
  async preflight() {
    return new FusionResponse()
      .status(200)
      .cors(['*'], ['POST', 'OPTIONS'])
      .header('Access-Control-Max-Age', '86400');
  }
}
```

### Diferentes tipos de contenido
```typescript
@Controller('/content')
class ContentController {
  @Get('/json')
  async getJson() {
    return FusionResponse.ok().json({ message: 'Hello JSON' });
  }

  @Get('/text')
  async getText() {
    return FusionResponse.ok().text('Hello World');
  }

  @Get('/html')
  async getHtml() {
    return FusionResponse.ok().html('<h1>Hello HTML</h1>');
  }
}
```

### Cache Control
```typescript
@Controller('/assets')
class AssetsController {
  @Get('/static/:file')
  async getStaticFile(event: APIGatewayEvent) {
    const file = await this.getFile(event.pathParameters?.file);
    
    return FusionResponse.ok(file)
      .cache(86400) // Cache por 24 horas
      .header('Content-Type', 'application/octet-stream');
  }

  @Get('/dynamic')
  async getDynamicContent() {
    const content = await this.generateContent();
    
    return FusionResponse.ok(content)
      .noCache(); // No cache
  }
}
```

### Manejo de errores personalizado
```typescript
@Controller('/secure')
class SecureController {
  @Get('/admin')
  async getAdminData(event: APIGatewayEvent) {
    if (!this.isAdmin(event)) {
      return FusionResponse.forbidden('Admin access required')
        .header('WWW-Authenticate', 'Bearer');
    }

    if (!this.isAuthenticated(event)) {
      return FusionResponse.unauthorized('Authentication required');
    }

    return FusionResponse.ok(await this.getAdminData());
  }

  @Post('/upload')
  async uploadFile(event: APIGatewayEvent) {
    if (this.isFileTooLarge(event.body)) {
      return FusionResponse
        .status(413) // Payload Too Large
        .json({ message: 'File too large', maxSize: '10MB' });
    }

    const result = await this.processUpload(event.body);
    return FusionResponse.created(result);
  }
}
```

## 3. Combinando con Use Cases

```typescript
@Controller('/orders')
class OrderController {
  constructor(private ucExecutor: UCExecutor) {}

  @Post('/')
  async createOrder(event: APIGatewayEvent) {
    try {
      const order = await this.ucExecutor.execute(
        CreateOrderUC, 
        JSON.parse(event.body || '{}')
      );
      
      return FusionResponse.created(order)
        .header('Location', `/orders/${order.id}`)
        .cors(['https://shop.com']);
    } catch (error) {
      if (error instanceof ValidationException) {
        return FusionResponse.badRequest(error.message);
      }
      if (error instanceof ResourceNotFoundException) {
        return FusionResponse.notFound(error.message);
      }
      throw error; // Let framework handle 500
    }
  }
}
```

## Comparación de Enfoques

| Escenario | Original | FusionResponse |
|-----------|----------|----------------|
| JSON simple | `return { data }` | `return { data }` (compatible) |
| Status personalizado | ❌ | `FusionResponse.status(201).json(data)` |
| Headers | ❌ | `.header('X-Custom', 'value')` |
| CORS | ❌ | `.cors(['origin.com'])` |
| Cache | ❌ | `.cache(3600)` |
| Respuesta vacía | `return null` → 204 | `FusionResponse.noContent()` |
| Errores | Throw exception | `FusionResponse.badRequest(msg)` |
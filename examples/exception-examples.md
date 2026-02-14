# Exception Examples

El Fusion Framework proporciona excepciones built-in para escenarios comunes de error HTTP.

## Excepciones Disponibles

| Excepción | Código HTTP | Uso Típico |
|-----------|-------------|------------|
| `ValidationException` | 400 | Errores de validación de entrada |
| `UnauthorizedException` | 401 | No autenticado |
| `ForbiddenException` | 403 | Sin permisos suficientes |
| `ResourceNotFoundException` | 404 | Recurso no encontrado |
| `ConflictException` | 409 | Conflicto de recursos (duplicados) |
| `UnprocessableEntityException` | 422 | Validación semántica/lógica de negocio |
| `TooManyRequestsException` | 429 | Rate limiting |
| `InternalServerErrorException` | 500 | Error interno del servidor |
| `BadGatewayException` | 502 | Error de gateway/proxy |
| `ServiceUnavailableException` | 503 | Servicio temporalmente no disponible |

## 1. ValidationException (400)

Usar para errores de validación de entrada (datos faltantes, formato incorrecto, etc.)

```typescript
import { ValidationException } from '@fusion-framework/server';

@Controller('/auth')
class AuthController {
  @Post('/register')
  async register(event: APIGatewayEvent) {
    const { email, password, name } = JSON.parse(event.body || '{}');

    // Validación de campos requeridos
    if (!email || !password || !name) {
      throw new ValidationException('Email, password, and name are required');
    }

    // Validación de formato
    if (!this.isValidEmail(email)) {
      throw new ValidationException('Invalid email format');
    }

    // Validación de complejidad
    if (password.length < 8) {
      throw new ValidationException('Password must be at least 8 characters');
    }

    const user = await this.userService.create({ email, password, name });
    return FusionResponse.created(user);
  }
}
```

## 2. UnauthorizedException (401)

Usar cuando se requiere autenticación pero no se proporcionó o es inválida.

```typescript
import { UnauthorizedException } from '@fusion-framework/server';

@Controller('/secure')
class SecureController {
  @Get('/profile')
  async getProfile(event: APIGatewayEvent) {
    const token = event.headers.Authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Authentication token required');
    }

    try {
      const user = await this.authService.verifyToken(token);
      return FusionResponse.ok(user.profile);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  @Post('/login')
  async login(event: APIGatewayEvent) {
    const { email, password } = JSON.parse(event.body || '{}');

    const user = await this.userService.findByEmail(email);

    if (!user || !await this.authService.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.authService.generateToken(user);
    return FusionResponse.ok({ token });
  }
}
```

## 3. ForbiddenException (403)

Usar cuando el usuario está autenticado pero no tiene permisos suficientes.

```typescript
import { ForbiddenException } from '@fusion-framework/server';

@Controller('/admin')
class AdminController {
  @Get('/users')
  async getAllUsers(event: APIGatewayEvent) {
    const currentUser = await this.authService.getCurrentUser(event);

    if (currentUser.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return FusionResponse.ok(await this.userService.getAll());
  }

  @Delete('/users/:id')
  async deleteUser(event: APIGatewayEvent) {
    const currentUser = await this.authService.getCurrentUser(event);
    const targetUserId = event.pathParameters?.id;

    // No puedes eliminarte a ti mismo
    if (currentUser.id === targetUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    // Solo super admins pueden eliminar otros admins
    const targetUser = await this.userService.findById(targetUserId);
    if (targetUser.role === 'admin' && currentUser.role !== 'superadmin') {
      throw new ForbiddenException('Only super admins can delete admin accounts');
    }

    await this.userService.delete(targetUserId);
    return FusionResponse.noContent();
  }
}
```

## 4. ResourceNotFoundException (404)

Usar cuando un recurso solicitado no existe.

```typescript
import { ResourceNotFoundException } from '@fusion-framework/server';

@Controller('/users')
class UserController {
  @Get('/:id')
  async getUser(event: APIGatewayEvent) {
    const userId = event.pathParameters?.id;

    const user = await this.userService.findById(userId);

    if (!user) {
      throw new ResourceNotFoundException(`User with ID ${userId} not found`);
    }

    return FusionResponse.ok(user);
  }

  @Put('/:id/avatar')
  async updateAvatar(event: APIGatewayEvent) {
    const userId = event.pathParameters?.id;

    const user = await this.userService.findById(userId);

    if (!user) {
      throw new ResourceNotFoundException('User not found');
    }

    const { avatarUrl } = JSON.parse(event.body || '{}');
    await this.userService.updateAvatar(userId, avatarUrl);

    return FusionResponse.ok({ avatarUrl });
  }
}
```

## 5. ConflictException (409)

Usar cuando hay un conflicto de recursos (ej: duplicados, violaciones de unicidad).

```typescript
import { ConflictException } from '@fusion-framework/server';

@Controller('/users')
class UserController {
  @Post('/register')
  async register(event: APIGatewayEvent) {
    const { email, username } = JSON.parse(event.body || '{}');

    // Verificar email duplicado
    const existingEmail = await this.userService.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    // Verificar username duplicado
    const existingUsername = await this.userService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const user = await this.userService.create({ email, username });
    return FusionResponse.created(user);
  }

  @Post('/teams/:teamId/members')
  async addTeamMember(event: APIGatewayEvent) {
    const { teamId } = event.pathParameters;
    const { userId } = JSON.parse(event.body || '{}');

    const isMember = await this.teamService.isMember(teamId, userId);

    if (isMember) {
      throw new ConflictException('User is already a member of this team');
    }

    await this.teamService.addMember(teamId, userId);
    return FusionResponse.created({ teamId, userId });
  }
}
```

## 6. UnprocessableEntityException (422)

Usar cuando la validación sintáctica pasa pero falla la validación semántica o reglas de negocio.

```typescript
import { UnprocessableEntityException } from '@fusion-framework/server';

@Controller('/orders')
class OrderController {
  @Post('/')
  async createOrder(event: APIGatewayEvent) {
    const orderData = JSON.parse(event.body || '{}');

    // Sintácticamente válido, pero semánticamente incorrecto
    if (orderData.quantity <= 0) {
      throw new UnprocessableEntityException('Order quantity must be greater than zero');
    }

    if (orderData.items.length === 0) {
      throw new UnprocessableEntityException('Order must contain at least one item');
    }

    // Validación de negocio
    const product = await this.productService.findById(orderData.productId);
    if (product.stock < orderData.quantity) {
      throw new UnprocessableEntityException(
        `Insufficient stock. Available: ${product.stock}, Requested: ${orderData.quantity}`
      );
    }

    if (orderData.deliveryDate < new Date()) {
      throw new UnprocessableEntityException('Delivery date cannot be in the past');
    }

    const order = await this.orderService.create(orderData);
    return FusionResponse.created(order);
  }
}
```

## 7. TooManyRequestsException (429)

Usar para implementar rate limiting.

```typescript
import { TooManyRequestsException } from '@fusion-framework/server';

@Controller('/api')
class ApiController {
  @Post('/send-email')
  async sendEmail(event: APIGatewayEvent) {
    const userId = event.requestContext.authorizer?.userId;

    // Rate limiting: máximo 10 emails por hora
    const emailCount = await this.rateLimiter.getCount(`email:${userId}`, 3600);

    if (emailCount >= 10) {
      throw new TooManyRequestsException('Email rate limit exceeded. Maximum 10 emails per hour');
    }

    const { to, subject, body } = JSON.parse(event.body || '{}');

    await this.emailService.send({ to, subject, body });
    await this.rateLimiter.increment(`email:${userId}`, 3600);

    return FusionResponse.ok({ sent: true });
  }

  @Get('/data')
  async getData(event: APIGatewayEvent) {
    const ip = event.requestContext.identity?.sourceIp;

    // Rate limiting por IP: 100 requests por minuto
    const requestCount = await this.rateLimiter.getCount(`ip:${ip}`, 60);

    if (requestCount >= 100) {
      const retryAfter = await this.rateLimiter.getTimeRemaining(`ip:${ip}`);

      return new FusionResponse({ error: 'Too many requests' })
        .status(429)
        .header('Retry-After', retryAfter.toString());
    }

    await this.rateLimiter.increment(`ip:${ip}`, 60);

    return FusionResponse.ok(await this.dataService.getData());
  }
}
```

## 8. InternalServerErrorException (500)

Usar para errores internos del servidor que no son culpa del cliente.

```typescript
import { InternalServerErrorException } from '@fusion-framework/server';

@Controller('/data')
class DataController {
  @Get('/report')
  async getReport(event: APIGatewayEvent) {
    try {
      const data = await this.databaseService.query('SELECT * FROM reports');
      return FusionResponse.ok(data);
    } catch (error) {
      console.error('Database query failed:', error);

      throw new InternalServerErrorException('Failed to generate report. Please try again later');
    }
  }

  @Post('/process')
  async processData(event: APIGatewayEvent) {
    const data = JSON.parse(event.body || '{}');

    try {
      const result = await this.processingService.process(data);
      return FusionResponse.ok(result);
    } catch (error) {
      // Log detallado internamente
      this.logger.error('Processing failed', { error, data });

      // Mensaje genérico al cliente (no exponer detalles internos)
      throw new InternalServerErrorException('An error occurred while processing your request');
    }
  }
}
```

## 9. BadGatewayException (502)

Usar cuando hay errores al comunicarse con servicios externos o upstream.

```typescript
import { BadGatewayException } from '@fusion-framework/server';

@Controller('/proxy')
class ProxyController {
  @Get('/weather/:city')
  async getWeather(event: APIGatewayEvent) {
    const city = event.pathParameters?.city;

    try {
      const response = await this.httpClient.get(
        `https://api.weather.com/v1/current?city=${city}`,
        { timeout: 5000 }
      );

      return FusionResponse.ok(response.data);
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new BadGatewayException('Weather service is currently unavailable');
      }

      if (error.response?.status >= 500) {
        throw new BadGatewayException('Weather service returned an error');
      }

      throw error;
    }
  }

  @Post('/payment')
  async processPayment(event: APIGatewayEvent) {
    const paymentData = JSON.parse(event.body || '{}');

    try {
      const result = await this.paymentGateway.charge(paymentData);
      return FusionResponse.ok(result);
    } catch (error) {
      this.logger.error('Payment gateway error', error);

      throw new BadGatewayException(
        'Payment gateway is temporarily unavailable. Please try again in a few minutes'
      );
    }
  }
}
```

## 10. ServiceUnavailableException (503)

Usar cuando el servicio está temporalmente no disponible (mantenimiento, sobrecarga, etc.)

```typescript
import { ServiceUnavailableException } from '@fusion-framework/server';

@Controller('/api')
class ApiController {
  @Get('/health')
  async healthCheck() {
    const dbHealthy = await this.database.ping();
    const cacheHealthy = await this.cache.ping();

    if (!dbHealthy) {
      throw new ServiceUnavailableException('Database is currently unavailable');
    }

    if (!cacheHealthy) {
      // Cache no es crítico, solo loggear
      this.logger.warn('Cache is unavailable');
    }

    return FusionResponse.ok({ status: 'healthy', database: 'up', cache: cacheHealthy ? 'up' : 'down' });
  }

  @Get('/data')
  async getData(event: APIGatewayEvent) {
    // Feature flag para mantenimiento
    if (await this.featureFlags.isEnabled('maintenance_mode')) {
      return new FusionResponse({ message: 'Service is under maintenance' })
        .status(503)
        .header('Retry-After', '3600'); // Retry después de 1 hora
    }

    // Circuit breaker
    if (this.circuitBreaker.isOpen()) {
      throw new ServiceUnavailableException(
        'Service is temporarily unavailable due to high error rate. Please try again later'
      );
    }

    return FusionResponse.ok(await this.dataService.getData());
  }
}
```

## Creando Excepciones Personalizadas

```typescript
import { FusionException } from '@fusion-framework/server';

// Excepción personalizada para pagos requeridos (402)
export class PaymentRequiredException extends FusionException {
  constructor(message: string = 'Payment Required') {
    super(402, message);
  }
}

// Excepción para contenido eliminado permanentemente (410)
export class GoneException extends FusionException {
  constructor(message: string = 'Resource permanently deleted') {
    super(410, message);
  }
}

// Excepción para precondiciones fallidas (412)
export class PreconditionFailedException extends FusionException {
  constructor(message: string = 'Precondition Failed') {
    super(412, message);
  }
}

// Uso
@Controller('/premium')
class PremiumController {
  @Get('/feature')
  async getPremiumFeature(event: APIGatewayEvent) {
    const user = await this.authService.getCurrentUser(event);

    if (!user.subscription?.active) {
      throw new PaymentRequiredException('Premium subscription required to access this feature');
    }

    return FusionResponse.ok({ data: 'Premium content' });
  }
}

@Controller('/posts')
class PostController {
  @Get('/:id')
  async getPost(event: APIGatewayEvent) {
    const postId = event.pathParameters?.id;
    const post = await this.postService.findById(postId);

    if (!post) {
      throw new ResourceNotFoundException('Post not found');
    }

    if (post.deletedAt && post.permanentlyDeleted) {
      throw new GoneException('This post has been permanently deleted');
    }

    return FusionResponse.ok(post);
  }

  @Put('/:id')
  async updatePost(event: APIGatewayEvent) {
    const postId = event.pathParameters?.id;
    const ifMatch = event.headers['If-Match'];

    const post = await this.postService.findById(postId);

    if (!post) {
      throw new ResourceNotFoundException('Post not found');
    }

    // Verificar ETag para optimistic locking
    if (ifMatch && post.etag !== ifMatch) {
      throw new PreconditionFailedException('Post has been modified by another user');
    }

    const updates = JSON.parse(event.body || '{}');
    const updatedPost = await this.postService.update(postId, updates);

    return FusionResponse.ok(updatedPost)
      .header('ETag', updatedPost.etag);
  }
}
```

## Manejo Global de Excepciones

```typescript
import { FusionException } from '@fusion-framework/server';

@Controller('/example')
class ExampleController {
  @Get('/data')
  async getData(event: APIGatewayEvent) {
    try {
      // Tu lógica aquí
      const data = await this.dataService.getData();
      return FusionResponse.ok(data);

    } catch (error) {
      // Manejar excepciones de Fusion
      if (error instanceof FusionException) {
        this.logger.warn('Business exception', { code: error.code, message: error.message });

        return new FusionResponse({ error: error.message })
          .status(error.code);
      }

      // Errores inesperados
      this.logger.error('Unexpected error', error);
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
```

## Mejores Prácticas

1. **Usar la excepción correcta**: Elige la excepción que mejor represente el error
2. **Mensajes descriptivos**: Proporciona mensajes claros que ayuden al cliente a entender el problema
3. **No exponer detalles internos**: En 500 errors, usa mensajes genéricos
4. **Logging apropiado**: Loggea detalles internos pero devuelve mensajes seguros al cliente
5. **Consistencia**: Usa el mismo formato de respuesta para todos los errores
6. **Documentación**: Documenta qué excepciones puede lanzar cada endpoint

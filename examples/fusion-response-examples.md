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

## 4. Soporte de Archivos Binarios (Base64)

El framework ahora soporta la devolución de archivos binarios codificados en base64, perfecto para imágenes, PDFs, y otros archivos.

### Métodos de conveniencia para archivos comunes

```typescript
@Controller('/files')
class FileController {
  @Get('/invoice/:id/pdf')
  async getInvoicePdf(event: APIGatewayEvent) {
    const invoiceId = event.pathParameters?.id;

    // Generar o recuperar PDF en base64
    const pdfBase64 = await this.generateInvoicePdf(invoiceId);

    // Devolver PDF con nombre de archivo sugerido
    return FusionResponse.pdf(pdfBase64);
  }

  @Get('/user/:id/avatar')
  async getUserAvatar(event: APIGatewayEvent) {
    const userId = event.pathParameters?.id;
    const avatarBase64 = await this.getAvatar(userId);

    // Devolver imagen PNG
    return FusionResponse.image(avatarBase64, 'png')
      .cache(3600) // Cachear por 1 hora
      .cors(['*']);
  }

  @Get('/user/:id/photo')
  async getUserPhoto(event: APIGatewayEvent) {
    const userId = event.pathParameters?.id;
    const photoBase64 = await this.getPhoto(userId);

    // Soporta: 'png', 'jpeg', 'jpg', 'gif', 'webp'
    return FusionResponse.image(photoBase64, 'jpeg');
  }

  @Get('/reports/:id/download')
  async downloadReport(event: APIGatewayEvent) {
    const reportId = event.pathParameters?.id;
    const reportData = await this.generateReport(reportId);

    // Archivo genérico con Content-Disposition para descarga
    return FusionResponse.file(
      reportData,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      `report-${reportId}.xlsx`
    );
  }
}
```

### Método manual para casos especiales

```typescript
@Controller('/custom')
class CustomFileController {
  @Get('/binary/:type')
  async getCustomBinary(event: APIGatewayEvent) {
    const fileType = event.pathParameters?.type;
    const binaryData = await this.getBinaryData(fileType);

    // Control manual completo
    return new FusionResponse(binaryData)
      .base64() // Marca la respuesta como base64
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', 'attachment; filename="data.bin"')
      .cache(7200);
  }

  @Get('/zip/:archive')
  async getZipFile(event: APIGatewayEvent) {
    const archiveName = event.pathParameters?.archive;
    const zipBase64 = await this.createZipArchive(archiveName);

    return new FusionResponse(zipBase64)
      .binary(zipBase64, 'application/zip')
      .header('Content-Disposition', `attachment; filename="${archiveName}.zip"`);
  }
}
```

### Ejemplo con S3

```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

@Controller('/media')
class MediaController {
  constructor(
    private s3Client: S3Client,
    private ucExecutor: UCExecutor
  ) {}

  @Get('/images/:key')
  async getImage(event: APIGatewayEvent) {
    const key = event.pathParameters?.key;

    // Obtener imagen de S3
    const command = new GetObjectCommand({
      Bucket: 'my-bucket',
      Key: key
    });

    const response = await this.s3Client.send(command);
    const buffer = await response.Body?.transformToByteArray();

    if (!buffer) {
      return FusionResponse.notFound('Image not found');
    }

    // Convertir a base64
    const base64Image = Buffer.from(buffer).toString('base64');

    // Determinar tipo de imagen basado en la extensión
    const imageType = key.endsWith('.png') ? 'png' : 'jpeg';

    return FusionResponse.image(base64Image, imageType)
      .cache(86400) // Cachear por 24 horas
      .cors(['*']);
  }

  @Get('/documents/:id')
  async getDocument(event: APIGatewayEvent) {
    const docId = event.pathParameters?.id;

    // Usar caso de uso para obtener documento
    const document = await this.ucExecutor.execute(GetDocumentUC, docId);

    if (!document) {
      return FusionResponse.notFound('Document not found');
    }

    // Retornar PDF con nombre personalizado
    return FusionResponse.file(
      document.base64Data,
      'application/pdf',
      `${document.name}.pdf`
    ).cors(['*']);
  }
}
```

### Generación dinámica de imágenes

```typescript
import { createCanvas } from 'canvas';

@Controller('/dynamic')
class DynamicImageController {
  @Get('/badge/:text')
  async generateBadge(event: APIGatewayEvent) {
    const text = event.pathParameters?.text || 'Badge';

    // Generar imagen con canvas
    const canvas = createCanvas(200, 50);
    const ctx = canvas.getContext('2d');

    // Dibujar badge
    ctx.fillStyle = '#007bff';
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, 100, 32);

    // Convertir a base64
    const imageBase64 = canvas.toBuffer('image/png').toString('base64');

    return FusionResponse.image(imageBase64, 'png')
      .cache(3600)
      .cors(['*']);
  }

  @Get('/qr/:data')
  async generateQR(event: APIGatewayEvent) {
    const data = decodeURIComponent(event.pathParameters?.data || '');

    // Generar QR code (usando librería como 'qrcode')
    const qrBase64 = await this.generateQRCode(data);

    return FusionResponse.image(qrBase64, 'png')
      .noCache() // QR dinámicos no deberían cachearse
      .cors(['*']);
  }
}
```

### Tipos de archivos soportados

El framework incluye helpers para los tipos de archivo más comunes:

| Método | Content-Type | Uso típico |
|--------|-------------|------------|
| `.pdf(data)` | `application/pdf` | Facturas, reportes, documentos |
| `.image(data, 'png')` | `image/png` | Capturas, gráficos, iconos |
| `.image(data, 'jpeg')` | `image/jpeg` | Fotos, imágenes comprimidas |
| `.image(data, 'gif')` | `image/gif` | Animaciones |
| `.image(data, 'webp')` | `image/webp` | Imágenes optimizadas web |
| `.file(data, type)` | Custom | Cualquier tipo de archivo |
| `.binary(data, type)` | Custom | Control manual completo |

### Notas importantes sobre Base64

1. **API Gateway**: El campo `isBase64Encoded: true` se incluye automáticamente en la respuesta Lambda
2. **Tamaño**: Lambda tiene un límite de 6MB para respuestas síncronas
3. **Performance**: Para archivos grandes, considera usar S3 con URLs pre-firmadas
4. **Cache**: Usa `.cache(seconds)` para reducir carga en archivos estáticos
5. **CORS**: Recuerda añadir `.cors()` si los archivos se acceden desde navegador

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
| Archivos binarios | ❌ | `FusionResponse.pdf(base64Data)` |
| Imágenes | ❌ | `FusionResponse.image(base64Data, 'png')` |
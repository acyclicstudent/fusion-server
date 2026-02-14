export class FusionResponse {
    private _statusCode: number = 200;
    private _headers: { [key: string]: string } = {};
    private _body: any = null;
    private _isBase64Encoded: boolean = false;

    constructor(body?: any) {
        if (body !== undefined) {
            this._body = body;
        }
    }

    status(code: number): FusionResponse {
        this._statusCode = code;
        return this;
    }

    header(name: string, value: string): FusionResponse {
        this._headers[name] = value;
        return this;
    }

    setHeaders(headers: { [key: string]: string }): FusionResponse {
        Object.assign(this._headers, headers);
        return this;
    }

    json(data: any): FusionResponse {
        this._body = data;
        this.header('Content-Type', 'application/json');
        return this;
    }

    text(data: string): FusionResponse {
        this._body = data;
        this.header('Content-Type', 'text/plain');
        return this;
    }

    html(data: string): FusionResponse {
        this._body = data;
        this.header('Content-Type', 'text/html');
        return this;
    }

    base64(encoded: boolean = true): FusionResponse {
        this._isBase64Encoded = encoded;
        return this;
    }

    binary(data: string, contentType: string): FusionResponse {
        this._body = data;
        this._isBase64Encoded = true;
        this.header('Content-Type', contentType);
        return this;
    }

    // Convenience methods for common status codes
    static ok(data?: any): FusionResponse {
        return new FusionResponse(data).status(200);
    }

    static created(data?: any): FusionResponse {
        return new FusionResponse(data).status(201);
    }

    static accepted(data?: any): FusionResponse {
        return new FusionResponse(data).status(202);
    }

    static noContent(): FusionResponse {
        return new FusionResponse().status(204);
    }

    static badRequest(message?: string): FusionResponse {
        return new FusionResponse({ message: message || 'Bad Request' }).status(400);
    }

    static unauthorized(message?: string): FusionResponse {
        return new FusionResponse({ message: message || 'Unauthorized' }).status(401);
    }

    static forbidden(message?: string): FusionResponse {
        return new FusionResponse({ message: message || 'Forbidden' }).status(403);
    }

    static notFound(message?: string): FusionResponse {
        return new FusionResponse({ message: message || 'Not Found' }).status(404);
    }

    static conflict(message?: string): FusionResponse {
        return new FusionResponse({ message: message || 'Conflict' }).status(409);
    }

    static internalServerError(message?: string): FusionResponse {
        return new FusionResponse({ message: message || 'Internal Server Error' }).status(500);
    }

    // Binary file convenience methods
    static pdf(base64Data: string): FusionResponse {
        return new FusionResponse(base64Data)
            .binary(base64Data, 'application/pdf');
    }

    static image(base64Data: string, type: 'png' | 'jpeg' | 'jpg' | 'gif' | 'webp' = 'png'): FusionResponse {
        const mimeType = type === 'jpg' ? 'jpeg' : type;
        return new FusionResponse(base64Data)
            .binary(base64Data, `image/${mimeType}`);
    }

    static file(base64Data: string, contentType: string, filename?: string): FusionResponse {
        const response = new FusionResponse(base64Data)
            .binary(base64Data, contentType);

        if (filename) {
            response.header('Content-Disposition', `attachment; filename="${filename}"`);
        }

        return response;
    }

    // CORS helper
    cors(origins: string[] = ['*'], methods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']): FusionResponse {
        return this
            .header('Access-Control-Allow-Origin', origins.join(', '))
            .header('Access-Control-Allow-Methods', methods.join(', '))
            .header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // Cache control helpers
    cache(seconds: number): FusionResponse {
        return this.header('Cache-Control', `max-age=${seconds}`);
    }

    noCache(): FusionResponse {
        return this.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    // Method to get the raw body (for direct Lambda responses like Bedrock, Cognito, etc.)
    toObject(): any {
        return this._body;
    }

    // Method to get the final response object for Lambda API Gateway
    toResponse(): { statusCode: number; headers: { [key: string]: string }; body: string; isBase64Encoded?: boolean } {
        let body: string;

        if (this._body === null || this._body === undefined) {
            body = '';
        } else if (typeof this._body === 'string') {
            body = this._body;
        } else {
            body = JSON.stringify(this._body);
            if (!this._headers['Content-Type']) {
                this._headers['Content-Type'] = 'application/json';
            }
        }

        const response: { statusCode: number; headers: { [key: string]: string }; body: string; isBase64Encoded?: boolean } = {
            statusCode: this._statusCode,
            headers: { ...this._headers },
            body
        };

        if (this._isBase64Encoded) {
            response.isBase64Encoded = true;
        }

        return response;
    }

    // Getters for internal use
    get statusCode(): number {
        return this._statusCode;
    }

    get headers(): { [key: string]: string } {
        return { ...this._headers };
    }

    get body(): any {
        return this._body;
    }

    get isBase64Encoded(): boolean {
        return this._isBase64Encoded;
    }
}
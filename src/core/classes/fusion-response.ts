export class FusionResponse {
    private _statusCode: number = 200;
    private _headers: { [key: string]: string } = {};
    private _body: any = null;

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

    // Method to get the final response object for Lambda
    toResponse(): { statusCode: number; headers: { [key: string]: string }; body: string } {
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

        return {
            statusCode: this._statusCode,
            headers: { ...this._headers },
            body
        };
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
}
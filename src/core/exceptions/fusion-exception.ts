export abstract class FusionException extends Error {
    public code: number;
    constructor(code: number, message: string) {
        super(message);
        this.code = code;
        // Restore prototype chain — required when targeting ES5/ES2015 because
        // extending built-ins like Error breaks `instanceof` without this.
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
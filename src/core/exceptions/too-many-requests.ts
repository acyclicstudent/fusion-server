import { FusionException } from "./fusion-exception";

export class TooManyRequestsException extends FusionException {
    constructor(message: string = 'Too Many Requests') {
        super(429, message);
    }
}

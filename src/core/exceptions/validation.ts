import { FusionException } from "./fusion-exception";

export class ValidationException extends FusionException {
    constructor(message: string = 'Bad Request') {
        super(400, message);
    }
}
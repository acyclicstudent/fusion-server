import { FusionException } from "./fusion-exception";

export class ValidationException extends FusionException {
    constructor(message: string) {
        super(400, message);
    }
}
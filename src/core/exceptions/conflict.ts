import { FusionException } from "./fusion-exception";

export class ConflictException extends FusionException {
    constructor(message: string = 'Conflict') {
        super(409, message);
    }
}

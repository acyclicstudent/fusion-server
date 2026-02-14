import { FusionException } from "./fusion-exception";

export class ForbiddenException extends FusionException {
    constructor(message: string = 'Forbidden') {
        super(403, message);
    }
}

import { FusionException } from "./fusion-exception";

export class UnauthorizedException extends FusionException {
    constructor(message: string = 'Unauthorized') {
        super(401, message);
    }
}

import { FusionException } from "./fusion-exception";

export class InternalServerErrorException extends FusionException {
    constructor(message: string = 'Internal Server Error') {
        super(500, message);
    }
}

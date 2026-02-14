import { FusionException } from "./fusion-exception";

export class UnprocessableEntityException extends FusionException {
    constructor(message: string = 'Unprocessable Entity') {
        super(422, message);
    }
}

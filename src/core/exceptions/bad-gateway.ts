import { FusionException } from "./fusion-exception";

export class BadGatewayException extends FusionException {
    constructor(message: string = 'Bad Gateway') {
        super(502, message);
    }
}

import { FusionException } from "./fusion-exception";

export class ServiceUnavailableException extends FusionException {
    constructor(message: string = 'Service Unavailable') {
        super(503, message);
    }
}

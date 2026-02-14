import { FusionException } from "./fusion-exception";

export class ResourceNotFoundException extends FusionException {
    constructor(message: string = 'Not Found') {
        super(404, message);
    }
}
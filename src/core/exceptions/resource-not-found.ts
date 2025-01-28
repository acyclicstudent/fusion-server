import { FusionException } from "./fusion-exception";

export class ResourceNotFoundException extends FusionException {
    constructor(message: string) {
        super(404, message);
    }
}
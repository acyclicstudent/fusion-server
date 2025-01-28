import { container } from "tsyringe";
import { UC } from "./uc";

export class UCExecutor {
    public execute<T extends UC>(
        UseCase: new (...dependencies: any) => T, 
        ...params: Parameters<T['execute']>
    ): ReturnType<T['execute']> {
        return container.resolve(UseCase).execute(...params);
    }
}
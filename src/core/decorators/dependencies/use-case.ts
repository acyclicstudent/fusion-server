import { injectable } from "tsyringe";

export function UseCase(): ClassDecorator {
    return (target: any) => {
        injectable()(target);
    }
}
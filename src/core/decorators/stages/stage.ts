import { inject } from "tsyringe";

export function Stage(): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        inject('stage')(target, propertyKey, parameterIndex);
    }
}
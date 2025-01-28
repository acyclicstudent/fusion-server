import 'reflect-metadata';
import { UCExecutor } from "../../classes/uc-executor";
import { inject } from "tsyringe";

export function Executor() {
    return inject(UCExecutor);
}
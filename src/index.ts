import 'reflect-metadata';
import { FusionServer } from "./fusion-server";

export const app = new FusionServer();

export * from './core/decorators';
export * from './core/exceptions';
export * from './core/interfaces/evt-listener';
export * from './core/interfaces/listener-config';
export * from './core/classes';
export * from './core/utils';
export * from './fusion-server';
export { container } from 'tsyringe';

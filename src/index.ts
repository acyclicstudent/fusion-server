import 'reflect-metadata';
import { FusionServer } from "./fusion-server";

export const app = new FusionServer();

export * from './decorators';
export * from './exceptions';
export * from './fusion-server';
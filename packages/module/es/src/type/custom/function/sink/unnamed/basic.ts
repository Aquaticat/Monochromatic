import type { Promisable } from "type-fest";

export type UnnamedBasicSync<T = unknown, Returns = unknown> = (value: T) => Returns;

export type UnnamedBasic<T = unknown, Returns = unknown> = (value: T) => Promisable<Returns>;

export type UnnamedBasicStringSync<Returns = unknown> = (value: string) => Returns;

export type UnnamedBasicString<Returns = unknown> = (value: string) => Promisable<Returns>;


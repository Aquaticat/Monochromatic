import type { Promisable } from "type-fest";

export type $Sync<T = unknown, Returns = unknown> = (value: T) => Returns;

export type $<T = unknown, Returns = unknown> = (value: T) => Promisable<Returns>;

export type $StringSync<Returns = unknown> = (value: string) => Returns;

export type $String<Returns = unknown> = (value: string) => Promisable<Returns>;

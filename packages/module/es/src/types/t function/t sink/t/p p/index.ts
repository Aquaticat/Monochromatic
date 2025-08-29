import type { Promisable } from "type-fest";

export type $<T = unknown, Returns = unknown> = (value: T) => Promisable<Returns>;

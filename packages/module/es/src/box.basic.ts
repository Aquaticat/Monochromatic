import type { Weightful } from "./weightful.basic.ts";

export type Box<T = unknown,> = {
  value: T;
} & Partial<Weightful>;

import type { Promisable } from "type-fest";
import type { Weightful } from "./weightful.basic";

export type Getable<K = unknown, V = unknown> = {
  get: (key: K)=> Promisable<V|undefined>,
} & Partial<Weightful>;

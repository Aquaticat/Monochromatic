import type { Promisable } from "type-fest";
import type { Weightful } from "./weightful.basic";

export type Getable<K = unknown, V = unknown> = {
  get: (key: K)=> Promisable<V|undefined>;
} & Partial<Weightful>;

export type GetableSync<K=unknown, V=unknown> = {
  get: (key: K) => V|undefined;
} & Partial<Weightful>;

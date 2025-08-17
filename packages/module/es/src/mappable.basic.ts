import type { Promisable } from "type-fest";

export type Mappable<V = unknown, Returns = unknown> = {
  map(fn: (value: V, index: number, mappable: Mappable<V, Returns>) => Promisable<Returns>): Promisable<Returns>
}

export type MappableSync<V= unknown, Returns = unknown> = {
  map(fn: (value: V, index: number, mappable: Mappable<V, Returns>) => Returns): Returns
}

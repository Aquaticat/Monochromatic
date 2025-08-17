import type { Promisable } from "type-fest";

export type Getable<T = unknown> = {
  get: (key: string)=> Promisable<T>,
  weight?: number,
}

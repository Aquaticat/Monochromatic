import type { Promisable, } from 'type-fest';
import type { Logged, } from './logged.basic.ts';
import type { Weightful, } from './weightful.basic';

export type Getable<K = unknown, V = unknown,> = {
  get: (
    { key, l, }: { key: K; } & Partial<Logged>,
  ) => Promisable<V | undefined>;
} & Partial<Weightful>;

export type GetableSync<K = unknown, V = unknown,> = {
  get: ({ key, l, }: { key: K; } & Partial<Logged>,) => V | undefined;
} & Partial<Weightful>;

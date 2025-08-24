import type { Promisable, } from 'type-fest';

export type $<Returns = unknown,> = (value: string,) => Promisable<Returns>;

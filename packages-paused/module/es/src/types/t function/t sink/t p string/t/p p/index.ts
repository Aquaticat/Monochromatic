import type { Promisable, } from 'type-fest';

/**
 * Sink function type accepting a string value, returning sync or async.
 */
export type $<Returns = unknown,> = (value: string,) => Promisable<Returns>;

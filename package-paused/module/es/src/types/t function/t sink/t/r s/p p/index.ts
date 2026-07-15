/**
 * Generic sync sink function type accepting any value.
 */
export type $<T = unknown, Returns = unknown,> = (value: T,) => Returns;

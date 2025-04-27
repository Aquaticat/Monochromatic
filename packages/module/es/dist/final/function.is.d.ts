import type { Promisable } from 'type-fest';
export declare function isAsyncFunction<T_fnReturnUnwrapped, T_inputs extends any[]>(fn: (...inputs: T_inputs) => Promisable<T_fnReturnUnwrapped>): fn is (...inputs: T_inputs) => Promise<T_fnReturnUnwrapped>;
export declare function isSyncFunction<T_fnReturnUnwrapped, T_inputs extends any[]>(fn: (...inputs: T_inputs) => Promisable<T_fnReturnUnwrapped>): fn is (...inputs: T_inputs) => T_fnReturnUnwrapped;

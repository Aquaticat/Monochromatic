import { type NotPromise } from './promise.ts';
/**
 Warning: BigInt is considered a primitive.

 @param value any value to check

 @returns if the value is primitive.
 We define primitive here in terms of what Object.is considers to be primitive:

 1.  undefined
 2.  null
 3.  true
 4.  false
 5.  string
 6.  bigint and BigInt
 7.  symbol
 8.  number
 9.  NaN
 */
export declare function isPrimitive(value: any): boolean;
export declare function equal(a: NotPromise, b: NotPromise): boolean;
/**
 @remarks
 We only handle two additional cases than {@inheritDoc equal}:
 1.  Both a and b are Promises
 2.  Both a and b are AsyncGenerators | AsyncIterables
 */
export declare function equalAsync(a: any, b: any): Promise<boolean>;

/** Very basic testing framework

 @remarks
 Not using something more sentible like Jest or Mocha because they inject their own global variables.
 Not using 'node:test' because that won't be compatible with bun or deno.
 We also won't need mocking.

 The intentional overuse of the `any` type here may or may not be fixed in the future,
 depending on how much impact it has. */
import type { Promisable } from 'type-fest';
export type Expect<T extends true> = T;
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
export type NotEqual<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? false : true;
type TestReturn = string | {
    name: string;
    result: unknown;
    tooLongPercentage?: number;
} | {
    name: string;
    skip: string;
} | {
    name: string;
    todo: string;
    result?: unknown;
    tooLongPercentage?: number;
};
type SuiteReturn = {
    name: string;
    result: PromiseSettledResult<Promisable<TestReturn | SuiteReturn>>[];
} | {
    name: string;
    skip: string;
} | {
    name: string;
    todo: string;
    result: PromiseSettledResult<Promisable<TestReturn | SuiteReturn>>[];
};
/** Pass in an Array of test(...) or suite(...) to create a suite or a supersuite. Fails fast.
 */
export declare function suite(name: string, testOrSuites: Promisable<TestReturn | SuiteReturn>[]): Promise<Extract<SuiteReturn, {
    name: string;
    result: PromiseSettledResult<Promisable<TestReturn | SuiteReturn>>[];
}>>;
export declare function suite(name: string, testOrSuites: Promisable<TestReturn | SuiteReturn>[], options: {
    skip: string;
}): Promise<Extract<SuiteReturn, {
    name: string;
    skip: string;
}>>;
export declare function suite(name: string, testOrSuites: Promisable<TestReturn | SuiteReturn>[], options: {
    todo: string;
}): Promise<Extract<SuiteReturn, {
    name: string;
    todo: string;
    result: PromiseSettledResult<Promisable<TestReturn | SuiteReturn>>[];
}>>;
export declare function test<T_callbackReturn extends undefined | null>(name: string, callback: (() => Promisable<T_callbackReturn>) | (() => void), options?: {
    timeLimit?: number | // TODO: Support erroring timeLimit compareTo fn
    (() => Promisable<unknown>);
}): Promise<string>;
export declare function test<T_callbackReturn extends NonNullable<unknown>>(name: string, callback: () => Promisable<T_callbackReturn>, options?: {
    timeLimit?: number | (() => Promisable<unknown>);
}): Promise<{
    name: string;
    result: T_callbackReturn;
}>;
export declare function test<T_callbackReturn>(name: string, callback: () => Promisable<T_callbackReturn>, options: {
    skip: string;
    timeLimit?: number | (() => Promisable<unknown>);
}): Promise<{
    name: string;
    skip: string;
}>;
export declare function test<T_callbackReturn extends undefined | null>(name: string, callback: (() => Promisable<T_callbackReturn>) | (() => void), options: {
    todo: string;
    timeLimit?: number | (() => Promisable<unknown>);
}): Promise<{
    name: string;
    todo: string;
    result?: unknown;
}>;
export declare function test<T_callbackReturn extends NonNullable<unknown>>(name: string, callback: () => Promisable<T_callbackReturn>, options: {
    todo: string;
    timeLimit?: number | (() => Promisable<unknown>);
}): Promise<{
    name: string;
    todo: string;
    result: unknown;
}>;
export {};

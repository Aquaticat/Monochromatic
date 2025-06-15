import type { Promisable } from 'type-fest';
import { isSyncFunction } from './function.is.ts';
import type { NotPromise } from './promise.type.ts';

/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0,>(
  input: T_0,
): Promise<T_0>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
): Promise<T_1>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
  fn2: (input1: T_1) => Promisable<T_2>,
): Promise<T_2>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2, T_3,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
  fn2: (input1: T_1) => Promisable<T_2>,
  fn3: (input2: T_2) => Promisable<T_3>,
): Promise<T_3>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2, T_3, T_4,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
  fn2: (input1: T_1) => Promisable<T_2>,
  fn3: (input2: T_2) => Promisable<T_3>,
  fn4: (input3: T_3) => Promisable<T_4>,
): Promise<T_4>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2, T_3, T_4,
  T_5,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
  fn2: (input1: T_1) => Promisable<T_2>,
  fn3: (input2: T_2) => Promisable<T_3>,
  fn4: (input3: T_3) => Promisable<T_4>,
  fn5: (input4: T_4) => Promisable<T_5>,
): Promise<T_5>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2, T_3, T_4, T_5,
  T_6,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
  fn2: (input1: T_1) => Promisable<T_2>,
  fn3: (input2: T_2) => Promisable<T_3>,
  fn4: (input3: T_3) => Promisable<T_4>,
  fn5: (input4: T_4) => Promisable<T_5>,
  fn6: (input5: T_5) => Promisable<T_6>,
): Promise<T_6>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2, T_3, T_4, T_5,
  T_6, T_7,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
  fn2: (input1: T_1) => Promisable<T_2>,
  fn3: (input2: T_2) => Promisable<T_3>,
  fn4: (input3: T_3) => Promisable<T_4>,
  fn5: (input4: T_4) => Promisable<T_5>,
  fn6: (input5: T_5) => Promisable<T_6>,
  fn7: (input6: T_6) => Promisable<T_7>,
): Promise<T_7>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2, T_3, T_4, T_5,
  T_6, T_7, T_8,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
  fn2: (input1: T_1) => Promisable<T_2>,
  fn3: (input2: T_2) => Promisable<T_3>,
  fn4: (input3: T_3) => Promisable<T_4>,
  fn5: (input4: T_4) => Promisable<T_5>,
  fn6: (input5: T_5) => Promisable<T_6>,
  fn7: (input6: T_6) => Promisable<T_7>,
  fn8: (input7: T_7) => Promisable<T_8>,
): Promise<T_8>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2, T_3, T_4, T_5,
  T_6, T_7, T_8, T_9,>(
  input: T_0,
  fn1: (input0: T_0) => Promisable<T_1>,
  fn2: (input1: T_1) => Promisable<T_2>,
  fn3: (input2: T_2) => Promisable<T_3>,
  fn4: (input3: T_3) => Promisable<T_4>,
  fn5: (input4: T_4) => Promisable<T_5>,
  fn6: (input5: T_5) => Promisable<T_6>,
  fn7: (input6: T_6) => Promisable<T_7>,
  fn8: (input7: T_7) => Promisable<T_8>,
  fn9: (input8: T_8) => Promisable<T_9>,
): Promise<T_9>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipedAsync<T_0, T_1, T_2, T_3, T_4, T_5,
  T_6, T_7, T_8, T_9,>(
  input: T_0,
  fn1?: (input0: T_0) => Promisable<T_1>,
  fn2?: (input1: T_1) => Promisable<T_2>,
  fn3?: (input2: T_2) => Promisable<T_3>,
  fn4?: (input3: T_3) => Promisable<T_4>,
  fn5?: (input4: T_4) => Promisable<T_5>,
  fn6?: (input5: T_5) => Promisable<T_6>,
  fn7?: (input6: T_6) => Promisable<T_7>,
  fn8?: (input7: T_7) => Promisable<T_8>,
  fn9?: (input8: T_8) => Promisable<T_9>,
): Promise<T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8 | T_9> {
  if (!fn1) {
    return input;
  }
  if (!fn2) {
    return await fn1(input);
  }
  if (!fn3) {
    return await fn2(await fn1(input));
  }
  if (!fn4) {
    return await fn3(await fn2(await fn1(input)));
  }
  if (!fn5) {
    return await fn4(await fn3(await fn2(await fn1(input))));
  }
  if (!fn6) {
    return await fn5(await fn4(await fn3(await fn2(await fn1(input)))));
  }
  if (!fn7) {
    return await fn6(await fn5(await fn4(await fn3(await fn2(await fn1(input))))));
  }
  if (!fn8) {
    return await fn7(
      await fn6(await fn5(await fn4(await fn3(await fn2(await fn1(input)))))),
    );
  }
  if (!fn9) {
    return await fn8(
      await fn7(await fn6(await fn5(await fn4(await fn3(await fn2(await fn1(input))))))),
    );
  }
  return await fn9(
    await fn8(
      await fn7(await fn6(await fn5(await fn4(await fn3(await fn2(await fn1(input))))))),
    ),
  );
}

/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0,>(
  input: T_0,
): T_0;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
): T_1;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
): T_2;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2, T_3,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
): T_3;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2, T_3, T_4,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
): T_4;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2, T_3, T_4, T_5,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
): T_5;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2, T_3, T_4, T_5, T_6,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
  fn6: (input5: T_5) => T_6,
): T_6;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
  fn6: (input5: T_5) => T_6,
  fn7: (input6: T_6) => T_7,
): T_7;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
  fn6: (input5: T_5) => T_6,
  fn7: (input6: T_6) => T_7,
  fn8: (input7: T_7) => T_8,
): T_8;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,>(
  input: T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
  fn6: (input5: T_5) => T_6,
  fn7: (input6: T_6) => T_7,
  fn8: (input7: T_7) => T_8,
  fn9: (input8: T_8) => T_9,
): T_9;
/* @__NO_SIDE_EFFECTS__ */ export function piped<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,>(
  input: T_0,
  fn1?: (input0: T_0) => T_1,
  fn2?: (input1: T_1) => T_2,
  fn3?: (input2: T_2) => T_3,
  fn4?: (input3: T_3) => T_4,
  fn5?: (input4: T_4) => T_5,
  fn6?: (input5: T_5) => T_6,
  fn7?: (input6: T_6) => T_7,
  fn8?: (input7: T_7) => T_8,
  fn9?: (input8: T_8) => T_9,
): T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8 | T_9 {
  if (!fn1) {
    return input;
  }
  if (!fn2) {
    return fn1(input);
  }
  if (!fn3) {
    return fn2(fn1(input));
  }
  if (!fn4) {
    return fn3(fn2(fn1(input)));
  }
  if (!fn5) {
    return fn4(fn3(fn2(fn1(input))));
  }
  if (!fn6) {
    return fn5(fn4(fn3(fn2(fn1(input)))));
  }
  if (!fn7) {
    return fn6(fn5(fn4(fn3(fn2(fn1(input))))));
  }
  if (!fn8) {
    return fn7(
      fn6(fn5(fn4(fn3(fn2(fn1(input)))))),
    );
  }
  if (!fn9) {
    return fn8(
      fn7(fn6(fn5(fn4(fn3(fn2(fn1(input))))))),
    );
  }
  return fn9(
    fn8(
      fn7(fn6(fn5(fn4(fn3(fn2(fn1(input))))))),
    ),
  );
}

// MAYBE: Can we fix type instantiation is excessively deep and possibly infinite for this?
//
// TODO: Switch to many layers of Awaited
//       Or switch to using the whole fn as generics?
//       This is complex. This will be fixed another day.
//
// MAYBE: Possibly don't need to declare it async
//        thus returning a fn that has to be unwrapped before using
//        despite having async in the name and can handle returning maybe async fn correctly?

/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => any,>(
  fn0: T_fn0,
): T_fn0;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
): (...inputs: T_inputs) => ReturnType<T_fn1>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn1>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn1>>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn1>>>;

//region 3

// 0/3
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): (...inputs: T_inputs) => ReturnType<T_fn2>;

// 1/3
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn2>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn2>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn2>>>;

// 2/3
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn2>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn2>>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn2>>>;

// 3/3
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn2>>>;

//endregion 3

//region 4

// 0/4
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => ReturnType<T_fn3>;

// 1/4
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn3>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn3>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn3>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>;

// 2/4
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn3>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn3>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn3>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>;

// 3/4
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<ReturnType<T_fn3>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>;

// 4/4
/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): (...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>;

//endregion 4

// More to follow...

/*
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
): Promise<(...inputs: T_inputs) => ReturnType<T_fn1>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn1>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn1>>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn1>>>>;

//region 3

// 0/3
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): Promise<(...inputs: T_inputs) => ReturnType<T_fn2>>;

// 1/3
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn2>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn2>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn2>>>>;

// 2/3
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn2>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn2>>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn2>>>>;

// 3/3
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn2>>>>;

//endregion 3

//region 4

// 0/4
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => ReturnType<T_fn3>>;

// 1/4
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>>;

// 2/4
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>>;

// 3/4
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => NotPromise,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<ReturnType<T_fn3>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => NotPromise,
  T_fn3 extends (input: ReturnType<T_fn2>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => NotPromise,
  T_fn2 extends (input: ReturnType<T_fn1>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>>;
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => NotPromise,
  T_fn1 extends (input: ReturnType<T_fn0>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>>;

// 4/4
/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => Promise<any>,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => Promise<any>,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => Promise<any>,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => Promise<any>,>(
  fn0: T_fn0,
  fn1: T_fn1,
  fn2: T_fn2,
  fn3: T_fn3,
): Promise<(...inputs: T_inputs) => Promise<Awaited<ReturnType<T_fn3>>>>;

//endregion 4

// TODO: More to follow. Write a program to generate these overloads.

/* @__NO_SIDE_EFFECTS__ */ export async function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => any,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => any,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => any,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => any,
  T_fn4 extends (input: Awaited<ReturnType<T_fn3>>) => any,
  T_fn5 extends (input: Awaited<ReturnType<T_fn4>>) => any,
  T_fn6 extends (input: Awaited<ReturnType<T_fn5>>) => any,
  T_fn7 extends (input: Awaited<ReturnType<T_fn6>>) => any,
  T_fn8 extends (input: Awaited<ReturnType<T_fn7>>) => any,
  T_fn9 extends (input: Awaited<ReturnType<T_fn8>>) => any,>(
  fn0: T_fn0,
  fn1?: T_fn1,
  fn2?: T_fn2,
  fn3?: T_fn3,
  fn4?: T_fn4,
  fn5?: T_fn5,
  fn6?: T_fn6,
  fn7?: T_fn7,
  fn8?: T_fn8,
  fn9?: T_fn9,
): Promise<(...inputs: T_inputs) => Promise<
  | T_fn0
  | Awaited<ReturnType<T_fn1>>
  | Awaited<ReturnType<T_fn2>>
  | Awaited<ReturnType<T_fn3>>
  | Awaited<ReturnType<T_fn4>>
  | Awaited<ReturnType<T_fn5>>
  | Awaited<ReturnType<T_fn6>>
  | Awaited<ReturnType<T_fn7>>
  | Awaited<ReturnType<T_fn8>>
  | Awaited<ReturnType<T_fn9>>
>>;

/* @__NO_SIDE_EFFECTS__ */ export function pipeAsync<T_inputs extends any[],
  T_fn0 extends (...inputs: T_inputs) => any,
  T_fn1 extends (input: Awaited<ReturnType<T_fn0>>) => any,
  T_fn2 extends (input: Awaited<ReturnType<T_fn1>>) => any,
  T_fn3 extends (input: Awaited<ReturnType<T_fn2>>) => any,
  T_fn4 extends (input: Awaited<ReturnType<T_fn3>>) => any,
  T_fn5 extends (input: Awaited<ReturnType<T_fn4>>) => any,
  T_fn6 extends (input: Awaited<ReturnType<T_fn5>>) => any,
  T_fn7 extends (input: Awaited<ReturnType<T_fn6>>) => any,
  T_fn8 extends (input: Awaited<ReturnType<T_fn7>>) => any,
  T_fn9 extends (input: Awaited<ReturnType<T_fn8>>) => any,>(
  fn0: T_fn0,
  fn1?: T_fn1,
  fn2?: T_fn2,
  fn3?: T_fn3,
  fn4?: T_fn4,
  fn5?: T_fn5,
  fn6?: T_fn6,
  fn7?: T_fn7,
  fn8?: T_fn8,
  fn9?: T_fn9,
):
  | T_fn0
  | ((...inputs: T_inputs) => Promise<
    | Awaited<ReturnType<T_fn1>>
    | Awaited<ReturnType<T_fn2>>
    | Awaited<ReturnType<T_fn3>>
    | Awaited<ReturnType<T_fn4>>
    | Awaited<ReturnType<T_fn5>>
    | Awaited<ReturnType<T_fn6>>
    | Awaited<ReturnType<T_fn7>>
    | Awaited<ReturnType<T_fn8>>
    | Awaited<ReturnType<T_fn9>>
  >)
{
  if (!fn1) {
    // FIXME: TypeScript native Array methods are losing type predicate!
    //        [fn0].every(isSyncFunction) doesn't preserve predicate.
    //        See https://github.com/microsoft/TypeScript/issues/26916
    //        Probably can't fix it even if a custom every is written
    // TODO: Replace with a custom some/every anyway.
    return fn0;
  }

  if (!fn2) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1)) {
      return function fn0to1(...inputs: T_inputs): ReturnType<T_fn1> {
        return fn1(fn0(...inputs));
      };
    }
    return async function fn0to1(
      ...inputs: T_inputs
    ): Promise<Awaited<ReturnType<T_fn1>>> {
      return await fn1(await fn0(...inputs));
    };
  }

  if (!fn3) {
    if (isSyncFunction(fn0) && isSyncFunction(fn1) && isSyncFunction(fn2)) {
      return function fn0to2(...inputs: T_inputs): ReturnType<T_fn2> {
        return fn2(fn1(fn0(...inputs)));
      };
    }
    return async function fn0to2(
      ...inputs: T_inputs
    ): Promise<Awaited<ReturnType<T_fn2>>> {
      return await fn2(await fn1(await fn0(...inputs)));
    };
  }

  if (!fn4) {
    if (
      isSyncFunction(fn0)
      && isSyncFunction(fn1)
      && isSyncFunction(fn2)
      && isSyncFunction(fn3)
    ) {
      return function fn0to3(...inputs: T_inputs): ReturnType<T_fn3> {
        return fn3(fn2(fn1(fn0(...inputs))));
      };
    }
    return async function fn0to3(
      ...inputs: T_inputs
    ): Promise<Awaited<ReturnType<T_fn3>>> {
      return await fn3(await fn2(await fn1(await fn0(...inputs))));
    };
  }

  if (!fn5) {
    if (
      isSyncFunction(fn0)
      && isSyncFunction(fn1)
      && isSyncFunction(fn2)
      && isSyncFunction(fn3)
      && isSyncFunction(fn4)
    ) {
      return function fn0to4(...inputs: T_inputs): ReturnType<T_fn4> {
        return fn4(fn3(fn2(fn1(fn0(...inputs)))));
      };
    }
    return async function fn0to4(
      ...inputs: T_inputs
    ): Promise<Awaited<ReturnType<T_fn4>>> {
      return await fn4(await fn3(await fn2(await fn1(await fn0(...inputs)))));
    };
  }

  if (!fn6) {
    if (
      isSyncFunction(fn0)
      && isSyncFunction(fn1)
      && isSyncFunction(fn2)
      && isSyncFunction(fn3)
      && isSyncFunction(fn4)
      && isSyncFunction(fn5)
    ) {
      return function fn0to5(...inputs: T_inputs): ReturnType<T_fn5> {
        return fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))));
      };
    }
    return async function fn0to5(
      ...inputs: T_inputs
    ): Promise<Awaited<ReturnType<T_fn5>>> {
      return await fn5(await fn4(await fn3(await fn2(await fn1(await fn0(...inputs))))));
    };
  }

  if (!fn7) {
    if (
      isSyncFunction(fn0)
      && isSyncFunction(fn1)
      && isSyncFunction(fn2)
      && isSyncFunction(fn3)
      && isSyncFunction(fn4)
      && isSyncFunction(fn5)
      && isSyncFunction(fn6)
    ) {
      return function fn0to6(...inputs: T_inputs): ReturnType<T_fn6> {
        return fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs)))))));
      };
    }
    return async function fn0to6(
      ...inputs: T_inputs
    ): Promise<Awaited<ReturnType<T_fn6>>> {
      return await fn6(
        await fn5(await fn4(await fn3(await fn2(await fn1(await fn0(...inputs)))))),
      );
    };
  }

  if (!fn8) {
    if (
      isSyncFunction(fn0)
      && isSyncFunction(fn1)
      && isSyncFunction(fn2)
      && isSyncFunction(fn3)
      && isSyncFunction(fn4)
      && isSyncFunction(fn5)
      && isSyncFunction(fn6)
      && isSyncFunction(fn7)
    ) {
      return function fn0to7(...inputs: T_inputs): ReturnType<T_fn7> {
        return fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))))));
      };
    }
    return async function fn0to7(
      ...inputs: T_inputs
    ): Promise<Awaited<ReturnType<T_fn7>>> {
      return await fn7(
        await fn6(
          await fn5(await fn4(await fn3(await fn2(await fn1(await fn0(...inputs)))))),
        ),
      );
    };
  }

  if (!fn9) {
    if (
      isSyncFunction(fn0)
      && isSyncFunction(fn1)
      && isSyncFunction(fn2)
      && isSyncFunction(fn3)
      && isSyncFunction(fn4)
      && isSyncFunction(fn5)
      && isSyncFunction(fn6)
      && isSyncFunction(fn7)
      && isSyncFunction(fn8)
    ) {
      return function fn0to8(...inputs: T_inputs): ReturnType<T_fn8> {
        return fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs)))))))));
      };
    }
    return async function fn0to8(
      ...inputs: T_inputs
    ): Promise<Awaited<ReturnType<T_fn8>>> {
      return await fn8(
        await fn7(
          await fn6(
            await fn5(
              await fn4(
                await fn3(
                  await fn2(
                    await fn1(
                      await fn0(...inputs),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    };
  }

  if (
    isSyncFunction(fn0)
    && isSyncFunction(fn1)
    && isSyncFunction(fn2)
    && isSyncFunction(fn3)
    && isSyncFunction(fn4)
    && isSyncFunction(fn5)
    && isSyncFunction(fn6)
    && isSyncFunction(fn7)
    && isSyncFunction(fn8)
    && isSyncFunction(fn9)
  ) {
    return function fn0to9(...inputs: T_inputs): ReturnType<T_fn9> {
      return fn9(fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))))))));
    };
  }

  return async function fn0to9(...inputs: T_inputs): Promise<Awaited<ReturnType<T_fn9>>> {
    // Enjoy this callback hell!
    return await fn9(
      await fn8(
        await fn7(
          await fn6(
            await fn5(
              await fn4(
                await fn3(
                  await fn2(
                    await fn1(
                      await fn0(...inputs),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0,>(
  fn0: (...inputs: T_inputs) => T_0,
): (...inputs: T_inputs) => T_0;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
): (...inputs: T_inputs) => T_1;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
): (...inputs: T_inputs) => T_2;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,
  T_3,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
): (...inputs: T_inputs) => T_3;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,
  T_3, T_4,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
): (...inputs: T_inputs) => T_4;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,
  T_3, T_4, T_5,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
): (...inputs: T_inputs) => T_5;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,
  T_3, T_4, T_5, T_6,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
  fn6: (input5: T_5) => T_6,
): (...inputs: T_inputs) => T_6;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,
  T_3, T_4, T_5, T_6, T_7,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
  fn6: (input5: T_5) => T_6,
  fn7: (input6: T_6) => T_7,
): (...inputs: T_inputs) => T_7;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,
  T_3, T_4, T_5, T_6, T_7, T_8,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
  fn6: (input5: T_5) => T_6,
  fn7: (input6: T_6) => T_7,
  fn8: (input7: T_7) => T_8,
): (...inputs: T_inputs) => T_8;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,
  T_3, T_4, T_5, T_6, T_7, T_8, T_9,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1: (input0: T_0) => T_1,
  fn2: (input1: T_1) => T_2,
  fn3: (input2: T_2) => T_3,
  fn4: (input3: T_3) => T_4,
  fn5: (input4: T_4) => T_5,
  fn6: (input5: T_5) => T_6,
  fn7: (input6: T_6) => T_7,
  fn8: (input7: T_7) => T_8,
  fn9: (input8: T_8) => T_9,
): (...inputs: T_inputs) => T_9;
/* @__NO_SIDE_EFFECTS__ */ export function pipe<T_inputs extends any[], T_0, T_1, T_2,
  T_3, T_4, T_5, T_6, T_7, T_8, T_9,>(
  fn0: (...inputs: T_inputs) => T_0,
  fn1?: (input0: T_0) => T_1,
  fn2?: (input1: T_1) => T_2,
  fn3?: (input2: T_2) => T_3,
  fn4?: (input3: T_3) => T_4,
  fn5?: (input4: T_4) => T_5,
  fn6?: (input5: T_5) => T_6,
  fn7?: (input6: T_6) => T_7,
  fn8?: (input7: T_7) => T_8,
  fn9?: (input7: T_8) => T_9,
):
  | ((...inputs: T_inputs) => T_0)
  | ((...inputs: T_inputs) => T_1)
  | ((...inputs: T_inputs) => T_2)
  | ((...inputs: T_inputs) => T_3)
  | ((...inputs: T_inputs) => T_4)
  | ((...inputs: T_inputs) => T_5)
  | ((...inputs: T_inputs) => T_6)
  | ((...inputs: T_inputs) => T_7)
  | ((...inputs: T_inputs) => T_8)
  | ((...inputs: T_inputs) => T_9)
{
  if (!fn1) {
    return function fn0to0(...inputs: T_inputs): T_0 {
      return fn0(...inputs);
    };
  }

  if (!fn2) {
    return function fn0to1(...inputs: T_inputs): T_1 {
      return fn1(fn0(...inputs));
    };
  }

  if (!fn3) {
    return function fn0to2(...inputs: T_inputs): T_2 {
      return fn2(fn1(fn0(...inputs)));
    };
  }

  if (!fn4) {
    return function fn0to3(...inputs: T_inputs): T_3 {
      return fn3(fn2(fn1(fn0(...inputs))));
    };
  }

  if (!fn5) {
    return function fn0to4(...inputs: T_inputs): T_4 {
      return fn4(fn3(fn2(fn1(fn0(...inputs)))));
    };
  }

  if (!fn6) {
    return function fn0to5(...inputs: T_inputs): T_5 {
      return fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))));
    };
  }

  if (!fn7) {
    return function fn0to6(...inputs: T_inputs): T_6 {
      return fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs)))))));
    };
  }

  if (!fn8) {
    return function fn0to7(...inputs: T_inputs): T_7 {
      return fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))))));
    };
  }

  if (!fn9) {
    return function fn0to8(...inputs: T_inputs): T_8 {
      return fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs)))))))));
    };
  }

  return function fn0to9(...inputs: T_inputs): T_9 {
    return fn9(fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0(...inputs))))))))));
  };
}

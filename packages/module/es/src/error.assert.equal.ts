import {
  equalsAsyncOrThrow,
  equalsOrThrow,
} from './function.equals.ts';
import type { NotPromise } from './promise.type.ts';

// We need not be so pedantic as to postfix every assert with Equal when equal is implied.

export async function assertAsync(expected: any, actual: any): Promise<void> {
  await equalsAsyncOrThrow(expected)(actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertTrueAsync(
  actual: any,
): Promise<void> {
  await assertAsync(true, await actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertFalseAsync(
  actual: any,
): Promise<void> {
  await assertAsync(false, await actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertUndefinedAsync(
  actual: any,
): Promise<void> {
  await assertAsync(undefined, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertNullAsync(
  actual: any,
): Promise<void> {
  await assertAsync(null, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertEmptyArrayAsync(
  actual: any,
): Promise<void> {
  await assertAsync([], actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertEmptyObjectAsync(
  actual: any,
): Promise<void> {
  await assertAsync({}, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assert0Async(
  actual: any,
): Promise<void> {
  await assertAsync(0, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assert1Async(
  actual: any,
): Promise<void> {
  await assertAsync(1, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertNanAsync(
  actual: any,
): Promise<void> {
  await assertAsync(Number.NaN, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertNegative1Async(
  actual: any,
): Promise<void> {
  await assertAsync(-1, actual);
}

// Side effect: throws.
export function assert(expected: NotPromise, actual: NotPromise): void {
  equalsOrThrow(expected)(actual);
}

export function assertTrue(actual: NotPromise): void {
  assert(true, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertFalse(actual: NotPromise): void {
  assert(false, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertUndefined(actual: NotPromise): void {
  assert(undefined, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertNull(actual: NotPromise): void {
  assert(null, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertEmptyArray(actual: NotPromise): void {
  assert([], actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertEmptyObject(actual: NotPromise): void {
  assert({}, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assert0(actual: NotPromise): void {
  assert(0, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assert1(actual: NotPromise): void {
  assert(1, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertNan(actual: NotPromise): void {
  assert(Number.NaN, actual);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertNegative1(actual: NotPromise): void {
  assert(-1, actual);
}

export * from './error.assert.equal.type.ts';

/** Cancellation observations preserve original cache publication and callback reentry. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFailureFixture, type FailureTokenFixture } from './native-group-failure-fixture.ts';

//region Cancellation cache publication follows original pending-delivery callbacks.
await describe({ name: '', children: [
  it({ name: 'reuses one signal occurrence while retaining distinct signals with equal reasons', fn: async function cache() {
    /** Signal identity determines cache identity even when native reasons are equal. */
    const f = createFailureFixture();
    /** Cancellation reason remains an opaque original value. */
    const original = Object.freeze({ cancellation: 'original' });
    /** First signal records the original observation location. */
    const observed = AbortSignal.abort(original);
    /** Same reason on another signal must produce another occurrence. */
    const other = AbortSignal.abort(original);
    /** Cache retains exact token identity after publication completes. */
    const first = f.owner.abortOccurrence({ observed, at: 'first' });
    assert.equal(f.owner.abortOccurrence({ observed, at: 'replay' }), first);
    assert.equal(first.occurrence.at, 'first');
    assert.equal(first.occurrence.error, original);
    /** Independent signal supplies a positive control for distinct observation. */
    const second = f.owner.abortOccurrence({ observed: other, at: 'other signal' });
    assert.notEqual(first, second);
    assert.equal(second.occurrence.error, original);
    assert.equal(second.occurrence.ordinal, 1);
    assert.equal(f.failures.length, 2);
    assert.deepEqual(f.events, ['reject', 'abort']);
  } }),
  it({ name: 'observes an uncancelled signal without inventing a new rejection boundary', fn: async function uncancelled() {
    /** Original helper reads the current reason even before signal cancellation. */
    const f = createFailureFixture();
    /** No native abort reason exists on this independent signal. */
    const observed = new AbortController().signal;
    /** Existing behavior records undefined and caches that exact occurrence. */
    const token = f.owner.abortOccurrence({ observed, at: 'uncancelled' });
    assert.equal(token.occurrence.error, undefined);
    assert.equal(f.owner.abortOccurrence({ observed, at: 'again' }), token);
    assert.equal(f.failures.length, 1);
  } }),
  it({ name: 'records reentry before outer cache publication then retains the outer token', fn: async function reentry() {
    /** Pending delivery can synchronously observe the same cancellation again. */
    const f = createFailureFixture();
    /** Original observed signal is independent from collector cancellation. */
    const observed = AbortSignal.abort('original');
    /** Inner token is published while the outer rejection callback remains active. */
    const inner: FailureTokenFixture[] = [];
    f.state.reenter = function observeAgain(): void {
      inner.push(f.owner.abortOccurrence({ observed, at: 'inner' }));
    };
    /** Outer publication replaces the completed inner cache entry after callback return. */
    const outer = f.owner.abortOccurrence({ observed, at: 'outer' });
    assert.equal(f.failures.length, 2);
    assert.equal(inner.length, 1);
    assert.equal(outer.occurrence, f.failures[0]);
    assert.equal(inner[0]?.occurrence, f.failures[1]);
    assert.equal(inner[0]?.occurrence.at, 'inner');
    assert.equal(f.state.primary, outer);
    assert.equal(f.owner.abortOccurrence({ observed, at: 'replay' }), outer);
    assert.deepEqual(f.events, ['reject', 'abort']);
  } }),
  it({ name: 'leaves cache unpublished after callback failure and retains a retry occurrence', fn: async function retry() {
    /** Throwing pending rejection retains primary state but prevents cache publication. */
    const f = createFailureFixture();
    /** Retrying the same signal must append because its first observation never completed. */
    const observed = AbortSignal.abort('original');
    f.state.failReject = true;
    assert.throws(function fail() { f.owner.abortOccurrence({ observed, at: 'first' }); }, function same(error: unknown) { return error === f.callbackFailure; });
    /** Existing primary prevents repeating the failing callback on retry. */
    const retried = f.owner.abortOccurrence({ observed, at: 'retry' });
    assert.equal(f.failures.length, 2);
    assert.equal(retried.occurrence, f.failures[1]);
    assert.equal(retried.occurrence.at, 'retry');
    assert.equal(f.state.primary?.occurrence, f.failures[0]);
    assert.equal(f.owner.abortOccurrence({ observed, at: 'replay' }), retried);
    assert.equal(f.controller.signal.aborted, false);
    assert.deepEqual(f.events, ['reject']);
  } }),
] });
//endregion

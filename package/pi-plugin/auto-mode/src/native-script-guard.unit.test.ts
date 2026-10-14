/**
 Built native result guards preserve caught values, diagnostic identity, and aggregate ownership.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

//region Consumer assertions establish the copied native guard interface

/**
 Native guards retain original caught values without declaring their runtime shape.
 */
type NativeGuard = Error & { readonly errors: readonly unknown[] };

/**
 Original tool and call identifiers appear only in diagnostics.
 */
type NativeCall = { readonly name: string; readonly id: string };

/**
 The built artifact exposes its original constructor and identity-preserving wrapper.
 */
type NativeGuardModule = {
  /**
   Constructor copies the original caught-value list.
   */
  readonly NativeScriptValueGuardError: new (input: {
    readonly errors: readonly unknown[];
    readonly call?: NativeCall;
  }) => NativeGuard;
  /**
   Existing guard errors must return unchanged.
   */
  readonly scriptValueGuard: (input: {
    readonly error: unknown;
    readonly call?: NativeCall;
  }) => NativeGuard;
};

/**
 Require the native artifact's callable exports before invoking its consumer interface.

 @param value - original copied native module

 @throws Error when either built export is absent
 */
function assertNativeGuardModule(value: unknown): asserts value is NativeGuardModule {
  if (((typeof value) !== 'object') || (value === null)
    || (!('NativeScriptValueGuardError' in value)) || ((typeof value.NativeScriptValueGuardError) !== 'function')
    || (!('scriptValueGuard' in value)) || ((typeof value.scriptValueGuard) !== 'function')) throw new Error('Built native result guard exports are unavailable');
}

/**
 Tests consume the same copied module imported by native judgment and return owners.
 */
const built: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/script-value-guard.ts',
  import.meta.url
).href);
assertNativeGuardModule(built);
/**
 Captured callables retain the checked contract inside deferred consumer tests.
 */
const { NativeScriptValueGuardError, scriptValueGuard } = built;

//endregion Consumer assertions establish the copied native guard interface

//region Aggregate errors retain identity, original descriptors, and borrowed values

await describe({
  name: '',
  children: [
    it({
      name: 'freezes only the copied error list and preserves its native property descriptor',
      fn: async function aggregateOwnership() {
        /** Mutable caught values remain caller-owned after aggregation. */
        const original = { changed: false };
        /** Primitive and object throws keep their original occurrence order. */
        const errors = [undefined, null, false, 0, 'original', original, new Error('caught')];
        /** The consumer constructor delegates copying and descriptors to AggregateError. */
        const guard = new NativeScriptValueGuardError({ errors });
        expect(guard).toBeInstanceOf(AggregateError);
        expect(guard.name).toBe('NativeScriptValueGuardError');
        expect(guard.errors).not.toBe(errors);
        expect(guard.errors.length).toBe(errors.length);
        for (const [index, error] of errors.entries()) expect(guard.errors[index]).toBe(error);
        expect(Object.isFrozen(guard.errors)).toBe(true);
        expect(Object.isFrozen(errors)).toBe(false);
        expect(Object.isFrozen(original)).toBe(false);
        expect(Object.getOwnPropertyDescriptor(guard, 'errors')).toEqual({ value: guard.errors, writable: true, enumerable: false, configurable: true });
        errors.length = 0;
        expect(guard.errors.length).toBe(7);
        original.changed = true;
        expect(guard.errors[5]).toHaveProperty('changed', true);
      },
    }),
    it({
      name: 'names the original call with JSON quoting and keeps the program fallback diagnostic',
      fn: async function callDiagnostics() {
        /** Quotes, newlines, and source-like text remain literal diagnostic metadata. */
        const call = { name: 'tool"\n${literal}', id: 'call\\"\n' };
        /** Native call metadata does not replace the retained failure value. */
        const callGuard = scriptValueGuard({ error: false, call });
        expect(callGuard.message).toBe(`Native result binding for tool ${JSON.stringify(call.name)} call ${JSON.stringify(call.id)} was rejected. Resolve the original source, lifetime, ownership or supported-value failure; do not replace its judgment with a fresh budget.`);
        expect(scriptValueGuard({ error: undefined }).message).toBe('Native result binding for original program result was rejected. Resolve the original source, lifetime, ownership or supported-value failure; do not replace its judgment with a fresh budget.');
      },
    }),
    it({
      name: 'propagates existing guards and derived guards without wrapping or relabeling them',
      fn: async function originalGuardIdentity() {
        /** Subclasses retain the original constructor-based diagnostic category. */
        class DerivedGuard extends NativeScriptValueGuardError {}
        /** Distinct original guard occurrences remain distinguishable. */
        const guards = [new NativeScriptValueGuardError({ errors: [false] }), new DerivedGuard({ errors: [undefined] })];
        for (const error of guards) expect(scriptValueGuard({ error, call: { name: 'later', id: 'later' } })).toBe(error);
        expect(guards[1]?.name).toBe('DerivedGuard');
      },
    }),
    ...[undefined, null, false, 0, 'original', {}, new Error('native failure')].map(function caughtValue(error, index) {
      return it({
        name: `retains exact caught value ${index} in a new native guard`,
        fn: async function originalCaughtValue() {
          /** New guard ownership does not clone or normalize the thrown value. */
          const guard = scriptValueGuard({ error });
          expect(guard).toBeInstanceOf(NativeScriptValueGuardError);
          expect(guard.errors.length).toBe(1);
          expect(guard.errors[0]).toBe(error);
        },
      });
    }),
  ],
});

//endregion Aggregate errors retain identity, original descriptors, and borrowed values

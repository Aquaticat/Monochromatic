/**
 Native root reading preserves original callbacks and exact identity before occurrence access.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

/** Independent runtime contract permits malformed JavaScript callback values. */
type RootReaderModule = {
  readonly createSessionRootReader: (input: {
    readonly readActiveSessionManager: unknown;
    readonly readManagerOccurrence: unknown;
  }) => (input: { readonly session: object; readonly manager: object }) => unknown;
};

/**
 Require the actual built export before exercising its ownership boundary.

 @param value - emitted native module namespace
 @returns assertion exposing the independently checked consumer surface
 @throws Error when the native artifact lacks its root reader
 */
function assertRootReaderModule(value: unknown): asserts value is RootReaderModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createSessionRootReader' in value))
    || ((typeof value.createSessionRootReader) !== 'function'))
    throw new Error('Built native session root reader is unavailable');
}

/** The generated native host consumes this emitted TypeScript module. */
const built: unknown = await import(new URL(
  '../dist/native/contract/lifecycle/root-lifecycle-retirement-entry/root-reader.ts',
  import.meta.url,
).href);
assertRootReaderModule(built);

//region Original callbacks retain identity and live pairing checks

await describe({ name: '', children: [
  it({ name: 'preserves exact arguments, occurrence identity, and callback order', fn: async function originalIdentity() {
    /** Original native objects remain borrowed and mutable. */
    const session = {};
    /** Native private state must return this exact object. */
    const manager = {};
    /** Each read may observe a new original occurrence. */
    const state = { occurrence: Object.freeze({}) };
    /** Calls distinguish authentication from occurrence publication. */
    const calls: unknown[] = [];
    /** Bootstrap callbacks retain their original references. */
    const callbacks = {
      readActiveSessionManager(value: object) { calls.push(['session', value]); return manager; },
      readManagerOccurrence(value: object) { calls.push(['occurrence', value]); return state.occurrence; },
    };
    /** Construction must not inspect current native state. */
    const read = built.createSessionRootReader(callbacks);
    expect(calls).toHaveLength(0);
    callbacks.readActiveSessionManager = function replacedSessionReader() { throw new Error('Replacement reader must not run'); };
    callbacks.readManagerOccurrence = function replacedOccurrenceReader() { throw new Error('Replacement reader must not run'); };
    expect(read({ session, manager })).toBe(state.occurrence);
    state.occurrence = Object.freeze({});
    expect(read({ session, manager })).toBe(state.occurrence);
    expect(calls).toEqual([['session', session], ['occurrence', manager], ['session', session], ['occurrence', manager]]);
    expect(Object.isFrozen(session)).toBe(false);
    expect(Object.isFrozen(manager)).toBe(false);
  } }),
  it({ name: 'rejects a changed native manager before reading its occurrence', fn: async function changedManager() {
    /** The same session remains selected while its private state changes. */
    const session = {};
    /** The expected manager stays unchanged. */
    const manager = {};
    /** A distinct object cannot stand in for the original. */
    const state = { manager };
    /** A valid first call positively controls occurrence access. */
    const calls: object[] = [];
    /** Returned occurrences are never substitutes for manager identity. */
    const occurrence = Object.freeze({});
    /** Native private state is checked on each read. */
    const read = built.createSessionRootReader({
      readActiveSessionManager() { return state.manager; },
      readManagerOccurrence(value: object) { calls.push(value); return occurrence; },
    });
    expect(read({ session, manager })).toBe(occurrence);
    state.manager = {};
    expect(function foreignManager() { return read({ session, manager }); }).toThrow('SDK session is not bound to this exact manager');
    expect(calls).toEqual([manager]);
  } }),

  //endregion Original callbacks retain identity and live pairing checks

  //region Missing readers and native failures cannot produce a root occurrence

  ...['session', 'occurrence'].flatMap(function callbackRole(role) {
    return [undefined, null, 'not callable', {}].map(function invalidCallback(value, index) {
      return it({ name: `rejects missing ${role} reader ${index} before invoking callbacks`, fn: async function missingReader() {
        /** Neither callback may run before both capabilities are validated. */
        const calls: string[] = [];
        /** A valid companion isolates each side of the guard. */
        function companion() { calls.push('invoked'); return {}; }
        expect(function constructInvalid() {
          return built.createSessionRootReader({
            readActiveSessionManager: role === 'session' ? value : companion,
            readManagerOccurrence: role === 'occurrence' ? value : companion,
          });
        }).toThrow('Native session and manager readers are required');
        expect(calls).toHaveLength(0);
      } });
    });
  }),
  ...['session', 'occurrence'].map(function failureRole(role) {
    return it({ name: `preserves the original ${role} reader failure`, fn: async function nativeFailure() {
      /** The adapter must preserve the exact thrown value. */
      const failure = new TypeError('Native private-state reader failed');
      /** Authentication succeeds whenever its callback completes. */
      const manager = {};
      /** Failed authentication must prevent occurrence access. */
      const calls: string[] = [];
      /** Original callbacks retain their own failure contract. */
      const read = built.createSessionRootReader({
        readActiveSessionManager() { calls.push('session'); if (role === 'session') throw failure; return manager; },
        readManagerOccurrence() { calls.push('occurrence'); throw failure; },
      });
      /** Identity comparison avoids mistaking a replacement error for preservation. */
      let caught: unknown;
      try { read({ session: {}, manager }); }
      catch (error) { caught = error; }
      expect(caught).toBe(failure);
      expect(calls).toEqual(role === 'session' ? ['session'] : ['session', 'occurrence']);
    } });
  }),

  //endregion Missing readers and native failures cannot produce a root occurrence
] });

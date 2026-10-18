/**
 Native resource admission rejects malformed descriptors while retaining complete sources.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { nativeResourceInput } from './native-resource-input-fixture.ts';

//region Malformed native inputs cannot acquire a retained resource snapshot

await describe({
  name: '',
  children: [
    ...[null, 1, [], Object.create({ inherited: true }) as unknown].map(function invalidRecord(value, ordinal) {
      return it({
        name: `rejects unsupported constructor record ${ordinal}`,
        fn: async function invalidOptions() {
          expect(function copyInvalidOptions() {
            nativeResourceInput.copyOptions(value);
          }).toThrow('Loader options require an ordinary record');
        },
      });
    }),
    ...[
      { agentsFiles: [], extra: true },
      { agentsFiles: [], [Symbol('unexpected symbol field in context input')]: true },
      {},
    ].map(function invalidContext(value, ordinal) {
      return it({
        name: `rejects changed context field membership ${ordinal}`,
        fn: async function contextFields() {
          expect(function copyInvalidContext() {
            nativeResourceInput.snapshotInput({ kind: 'context', value });
          }).toThrow('Context input has unsupported fields');
        },
      });
    }),
    it({
      name: 'rejects option, context, and array accessors without invoking them',
      fn: async function accessors() {
        /** An accessor invocation must remain observable even if later copying rejects. */
        const state = { calls: 0 };
        /** This accessor is shared by disposable input descriptors only. */
        function readUnexpectedValue(): string {
          state.calls++;
          return 'unexpected';
        }
        /** Own accessor options must not be selected as opaque data. */
        const options = Object.defineProperty({}, 'dependency', { enumerable: true, get: readUnexpectedValue });
        /** Context schema membership alone cannot authenticate an accessor value. */
        const context = Object.defineProperty({}, 'agentsFiles', { enumerable: true, get: readUnexpectedValue });
        /** The original array length and own-key count still look dense. */
        const entries = Object.defineProperty(['original'], '0', { enumerable: true, get: readUnexpectedValue });
        expect(function copyAccessorOptions() {
            nativeResourceInput.copyOptions(options);
          }).toThrow('Loader options require named data properties');
        expect(function copyAccessorContext() {
            nativeResourceInput.snapshotInput({ kind: 'context', value: context });
          }).toThrow('Context input requires data fields');
        expect(function copyAccessorArray() {
            nativeResourceInput.snapshotInput({ kind: 'append', value: entries });
          }).toThrow('Append input contains a missing or accessor entry');
        expect(state.calls).toBe(0);
      },
    }),
    it({
      name: 'rejects hidden, symbolic, and prototype-mutating option fields',
      fn: async function optionFields() {
        /** Hidden own data still lies outside the native options contract. */
        const hidden = Object.defineProperty({}, 'cwd', { value: '/workspace' });
        /** JSON supplies an own prototype-named field without invoking object-literal prototype syntax. */
        const prototypeField: unknown = JSON.parse('{"__proto__":{"changed":true}}');
        for (const options of [hidden, { [Symbol('unsupported symbolic loader dependency')]: 'hidden' }, prototypeField]) {
          expect(function copyUnsupportedField() {
            nativeResourceInput.copyOptions(options);
          }).toThrow('Loader options require named data properties');
        }
      },
    }),
    it({
      name: 'rejects sparse, extended, and nonordinary arrays',
      fn: async function arrayShape() {
        /** Array construction intentionally leaves its indexed entry absent. */
        const sparse: unknown = Reflect.construct(Array, [1]);
        /** Additional own properties must not be lost while copying. */
        const extended = Object.defineProperty([], 'extra', { value: 'unexpected', enumerable: true });
        /** An array with a foreign prototype is outside the original profile. */
        const altered: unknown = Object.setPrototypeOf(['text'], null);
        for (const value of [sparse, extended, altered, 'text']) {
          expect(function copyUnsupportedArray() {
            nativeResourceInput.snapshotInput({ kind: 'append', value });
          }).toThrow('Append input requires an ordinary dense array');
        }
      },
    }),
    it({
      name: 'rejects malformed context files, nontext inputs, and unknown source kinds',
      fn: async function inputKinds() {
        expect(function copyUnknownKind() {
            nativeResourceInput.snapshotInput({ kind: 'unrecognized', value: '' });
          }).toThrow('Unknown resource input kind');
        expect(function copyNontextSystem() {
            nativeResourceInput.snapshotInput({ kind: 'system', value: 1 });
          }).toThrow('System input requires text');
        expect(function copyNontextAppend() {
            nativeResourceInput.snapshotInput({ kind: 'append', value: [1] });
          }).toThrow('Append text requires text');
        expect(function copyMalformedFile() {
            nativeResourceInput.snapshotInput({ kind: 'context', value: { agentsFiles: [{ path: 'AGENTS.md' }] } });
          }).toThrow('Context file has unsupported fields');
      },
    }),
    it({
      name: 'preserves complete text, resource bundles, and lists beyond former ceilings',
      fn: async function completeSources() {
        /** Cross both the former text ceiling and its multibyte equivalent. */
        const text = '🚀'.repeat(65_537);
        expect(nativeResourceInput.snapshotInput({ kind: 'system', value: text })).toBe(text);
        /** Cross former aggregate byte and context-file count limits together. */
        const agentsFiles = Array.from({ length: 65 }, function contextFile() {
          return { path: 'AGENTS.md', content: text };
        });
        expect(nativeResourceInput.snapshotInput({ kind: 'context', value: { agentsFiles } })).toEqual({ agentsFiles });
        /** Preserve every append occurrence, including equal content. */
        const appended = Array.from({ length: 33 }, function appendText() { return text; });
        expect(nativeResourceInput.snapshotInput({ kind: 'append', value: appended })).toEqual(appended);
      },
    }),
  ],
});

//endregion Malformed native inputs cannot acquire a retained resource snapshot

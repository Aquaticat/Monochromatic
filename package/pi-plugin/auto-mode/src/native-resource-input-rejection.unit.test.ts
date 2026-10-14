/**
 Native resource admission rejects malformed descriptors and over-budget complete sources.

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
      { agentsFiles: [], [Symbol('extra')]: true },
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
        for (const options of [hidden, { [Symbol('dependency')]: 'hidden' }, prototypeField]) {
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
          }).toThrow('Append input requires a bounded ordinary dense array');
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
          }).toThrow('System input requires bounded text');
        expect(function copyNontextAppend() {
            nativeResourceInput.snapshotInput({ kind: 'append', value: [1] });
          }).toThrow('Append text requires bounded text');
        expect(function copyMalformedFile() {
            nativeResourceInput.snapshotInput({ kind: 'context', value: { agentsFiles: [{ path: 'AGENTS.md' }] } });
          }).toThrow('Context file has unsupported fields');
      },
    }),
    it({
      name: 'retains exact text-byte limits and rejects complete-input overflow',
      fn: async function sourceBudgets() {
        /** Exact original single-source byte ceiling remains admissible. */
        const textBytes = 65_536;
        /** Complete individual text fits before aggregate accounting. */
        const text = 'a'.repeat(textBytes);
        expect(nativeResourceInput.snapshotInput({ kind: 'system', value: text })).toBe(text);
        expect(function oversizedText() {
            nativeResourceInput.snapshotInput({ kind: 'system', value: `${text}a` });
          }).toThrow('System input requires bounded text');
        expect(function multibyteText() {
            nativeResourceInput.snapshotInput({ kind: 'system', value: '🚀'.repeat(textBytes / 2) });
          }).toThrow('System input requires bounded text');
        /** Each file fits separately while their combined complete source exceeds the original budget. */
        const agentsFiles = Array.from({ length: 9 }, function contextFile() {
          return { path: 'AGENTS.md', content: text };
        });
        expect(function oversizedSnapshot() {
            nativeResourceInput.snapshotInput({ kind: 'context', value: { agentsFiles } });
          }).toThrow('Resource input exceeds total byte bound');
        expect(function tooManyAppendEntries() {
            nativeResourceInput.snapshotInput({ kind: 'append', value: Array.from({ length: 33 }, function emptyText() {
              return '';
            }) });
          }).toThrow('Append input requires a bounded ordinary dense array');
        expect(function tooManyContextFiles() {
            nativeResourceInput.snapshotInput({ kind: 'context', value: { agentsFiles: Array.from({ length: 65 }, function emptyFile() {
              return { path: '', content: '' };
            }) } });
          }).toThrow('Context files requires a bounded ordinary dense array');
      },
    }),
  ],
});

//endregion Malformed native inputs cannot acquire a retained resource snapshot

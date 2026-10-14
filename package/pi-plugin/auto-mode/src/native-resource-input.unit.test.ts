/**
 Original resource snapshots detach text while retaining opaque constructor dependencies.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { nativeResourceInput } from './native-resource-input-fixture.ts';

//region Built copies preserve original native source values and ownership

await describe({
  name: '',
  children: [
    it({
      name: 'retains the original collector error constructor across typed resource copies',
      fn: async function sharedCollectionError() {
        /** Existing JavaScript consumers retain their original collector import path. */
        const original: unknown = await import(new URL('../dist/native/contract/collector/collector.mjs', import.meta.url).href);
        /** Typed consumers share the same original error category. */
        const current: unknown = await import(new URL('../dist/native/contract/collector/errors.ts', import.meta.url).href);
        if (((typeof current) !== 'object') || (current === null) || (!('SourceCollectionError' in current)) || ((typeof current.SourceCollectionError) !== 'function')) throw new Error('Missing built collection error constructor');
        expect(original).toHaveProperty('SourceCollectionError', current.SourceCollectionError);
        /** Runtime construction retains the original diagnostic name. */
        const error: unknown = Reflect.construct(current.SourceCollectionError, ['original source']);
        expect(error).toHaveProperty('name', 'SourceCollectionError');
        expect(error).toHaveProperty('message', 'original source');
      },
    }),
    it({
      name: 'detaches context files and freezes only the copied source graph',
      fn: async function contextCopy() {
        /** Caller-owned source records must remain mutable. */
        const source = { agentsFiles: [{ path: 'AGENTS.md', content: 'original' }] };
        /** Snapshot receives complete native file text and original ordering. */
        const snapshot = nativeResourceInput.snapshotInput({ kind: 'context', value: source });
        expect(snapshot).toEqual(source);
        expect(snapshot).not.toBe(source);
        expect(Object.isFrozen(snapshot)).toBe(true);
        if (((typeof snapshot) !== 'object') || (snapshot === null) || (!('agentsFiles' in snapshot)) || (!Array.isArray(snapshot.agentsFiles))) throw new Error('Expected copied context file list');
        expect(Object.isFrozen(snapshot.agentsFiles)).toBe(true);
        expect(Object.isFrozen(snapshot.agentsFiles[0])).toBe(true);
        expect(Object.isFrozen(source)).toBe(false);
        expect(Object.isFrozen(source.agentsFiles)).toBe(false);
        expect(Object.isFrozen(source.agentsFiles[0])).toBe(false);
        source.agentsFiles[0] = { path: 'changed.md', content: 'changed' };
        expect(snapshot).toHaveProperty('agentsFiles.0.path', 'AGENTS.md');
        expect(snapshot).toHaveProperty('agentsFiles.0.content', 'original');
      },
    }),
    it({
      name: 'retains absent and complete system text, including syntax delimiters',
      fn: async function systemCopy() {
        /** Text remains data across quotes, comments, control characters, and path tokens. */
        const text = `quote'"; /* literal */\n\\path/../\` \${globalThis.injected=true}\u0000🚀`;
        expect(nativeResourceInput.snapshotInput({ kind: 'system', value: undefined })).toBeUndefined();
        expect(nativeResourceInput.snapshotInput({ kind: 'system', value: text })).toBe(text);
        expect(nativeResourceInput.snapshotInput({ kind: 'system', value: '' })).toBe('');
      },
    }),
    it({
      name: 'copies and freezes appended text without freezing its borrowed array',
      fn: async function appendCopy() {
        /** Native input remains available for later SDK mutation. */
        const source = ['first', 'second'];
        /** Retained text belongs only to this snapshot. */
        const snapshot = nativeResourceInput.snapshotInput({ kind: 'append', value: source });
        expect(snapshot).toEqual(source);
        expect(snapshot).not.toBe(source);
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(source)).toBe(false);
        source[0] = 'changed';
        expect(snapshot).toEqual(['first', 'second']);
      },
    }),
    it({
      name: 'retains opaque constructor dependencies while detaching appended text',
      fn: async function constructorCopy() {
        /** Opaque dependency identity must remain the native caller's original object. */
        const dependency = { state: 'original' };
        /** The source array remains owned by the caller. */
        const append = ['original'];
        /** Constructor copying neither clones nor freezes opaque dependencies. */
        const options = { dependency, appendSystemPrompt: append };
        /** Only the new options record and copied instruction text are owned here. */
        const copy = nativeResourceInput.copyOptions(options);
        expect(copy).not.toBe(options);
        expect(copy.dependency).toBe(dependency);
        expect(copy.appendSystemPrompt).not.toBe(append);
        expect(Object.isFrozen(copy.appendSystemPrompt)).toBe(true);
        expect(Object.isFrozen(copy)).toBe(false);
        expect(Object.isFrozen(dependency)).toBe(false);
        append[0] = 'changed';
        expect(copy.appendSystemPrompt).toEqual(['original']);
        expect(nativeResourceInput.copyOptions({ appendSystemPrompt: undefined })).toHaveProperty('appendSystemPrompt', undefined);
      },
    }),
    it({
      name: 'accepts null-prototype constructor and context records',
      fn: async function nullPrototypeRecords() {
        /** Native options allow ordinary records with no inherited properties. */
        const options: unknown = Object.create(null, { cwd: { value: '/workspace', enumerable: true } });
        /** Context records retain their original null-prototype allowance. */
        const context: unknown = Object.create(null, { agentsFiles: { value: [], enumerable: true } });
        expect(nativeResourceInput.copyOptions(options)).toEqual({ cwd: '/workspace' });
        expect(nativeResourceInput.snapshotInput({ kind: 'context', value: context })).toEqual({ agentsFiles: [] });
      },
    }),
  ],
});

//endregion Built copies preserve original native source values and ownership

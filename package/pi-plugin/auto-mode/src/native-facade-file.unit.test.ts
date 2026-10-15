/** Built dependency facade preserves inert original bytes and fresh descriptor-bound revalidation. @module */
import assert from 'node:assert/strict';
import { stat, writeFile } from 'node:fs/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFacadeFileFixture } from './native-facade-file-fixture.ts';

//region Original file evidence remains inert while live and retained revalidation observe current files.
await describe({ name: '', children: [
  it({ name: 'retains original selected bytes and rejects changed live and retained files', fn: async function originalBytes() {
    /** Every file mutation belongs to this disposable selected root. */
    await using f = await createFacadeFileFixture();
    /** Original inode identity is measured before preparation without changing file contents. */
    const metadata = await stat(f.path, { bigint: true });
    /** Declared native reader captures completed original bytes synchronously. */
    const owner = f.construct();
    /** Original handle retains the file observation independently of later writes. */
    const handle = owner.prepare({ signal: f.controller.signal });
    assert.ok(f.events.includes('prepare.file:policy.enter'));
    assert.ok(f.events.includes('prepare.file:policy.return'));
    f.events.length = 0;
    /** Original inspection reads the issued record rather than reopening the selected file. */
    const view = owner.originalFile({ handle, absolutePath: f.path });
    assert.deepEqual(view, {
      kind: 'original-file', absolutePath: f.path, relativePath: 'policy',
      dev: String(metadata.dev), ino: String(metadata.ino), mode: 0o600, bytesBase64: f.bytes.toString('base64'),
    });
    assert.equal(Object.isFrozen(view), true);
    assert.deepEqual(f.events, ['clock']);
    assert.equal(owner.finalize(handle).decisionDeadlineChecked, true);
    assert.equal(owner.checkRetained(handle).decisionDeadlineChecked, false);
    await writeFile(f.path, Buffer.from('changed original file'));
    assert.deepEqual(owner.originalFile({ handle, absolutePath: f.path }), view);
    assert.throws(function changedLive() { owner.finalize(handle); }, { name: 'ObservedFileStaleError' });
    assert.throws(function changedRetained() { owner.checkRetained(handle); }, { name: 'ObservedFileStaleError' });
    await writeFile(f.path, f.bytes);
    assert.equal(owner.finalize(handle).mechanicalDependenciesCurrent, true);
    assert.equal(owner.checkRetained(handle).mechanicalDependenciesCurrent, true);
    assert.deepEqual(owner.originalFile({ handle, absolutePath: {} }), { kind: 'undeclared-file' });
  } }),
  it({ name: 'keeps controlled reader identity while withholding a native-byte projection', fn: async function controlled() {
    /** Declared reader supplies the same bytes as the independent file metadata. */
    await using f = await createFacadeFileFixture();
    /** Controlled reads receive the original bounded destination and source position. */
    const reads: object[] = [];
    /** Original declaration is copied once when the facade is constructed. */
    const declaration = {
      relativePath: 'policy', requiredMode: 0o600,
      read(input: Readonly<{ fd: number; buffer: Buffer; offset: number; length: number; position: number }>): number {
        reads.push(input);
        assert.equal(typeof input.fd, 'number');
        return f.bytes.copy(input.buffer, input.offset, input.position, input.position + input.length);
      },
    };
    f.options.files = [declaration];
    /** The owner retains its original validated profile after caller declarations change. */
    const owner = f.construct();
    declaration.relativePath = 'replacement';
    /** Original path and controlled reader still supply the prepared file observation. */
    const handle = owner.prepare({ signal: f.controller.signal });
    assert.ok(reads.length > 0);
    /** Controlled observation remains explicitly distinct from a native-byte projection. */
    const view = owner.originalFile({ handle, absolutePath: f.path });
    assert.deepEqual(view, { kind: 'controlled-file-observer' });
    assert.equal(Object.isFrozen(view), true);
    assert.equal(owner.finalize(handle).mechanicalDependenciesCurrent, true);
    assert.equal(owner.checkRetained(handle).mechanicalDependenciesCurrent, true);
  } }),
  ...['prepare.file:policy.enter', 'prepare.file:policy.return', 'finalize.file:policy.enter', 'finalize.file:policy.return'].map(function fileBoundary(point) {
    return it({ name: `retains original trace failure at ${point}`, fn: async function fileFailure() {
      /** Failure is attached only after a disposable declared file exists. */
      await using f = await createFacadeFileFixture();
      /** Original file observer remains inside the same issuing facade. */
      const owner = f.construct();
      if (point.startsWith('prepare')) {
        f.state.fail = point;
        assert.throws(function failedPreparation() { owner.prepare({ signal: f.controller.signal }); }, function same(error: unknown) { return error === f.failure; });
      } else {
        /** Finalization faults retain completed original preparation observations. */
        const handle = owner.prepare({ signal: f.controller.signal });
        f.state.fail = point;
        assert.throws(function failedFinalization() { owner.finalize(handle); }, function same(error: unknown) { return error === f.failure; });
        assert.throws(function failedRetention() { owner.checkRetained(handle); }, function same(error: unknown) { return error === f.failure; });
      }
      assert.equal(f.events.at(-1), point);
    } });
  }),
] });
//endregion

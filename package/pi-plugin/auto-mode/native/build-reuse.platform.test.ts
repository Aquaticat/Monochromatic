/** Verify immutable file reuse across actual mount boundaries. @module */
import { strict as assert } from 'node:assert';
import { link, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { reuseNativeBuildFiles } from './build-reuse.ts';

//region The caller supplies disposable directories on distinct mounts of the same filesystem.
/** Previous-file mount owned exclusively by the outer platform fixture. */
const previousMount = process.argv[2];
/** New-file mount owned exclusively by the outer platform fixture. */
const outputMount = process.argv[3];
assert.equal(typeof previousMount, 'string');
assert.equal(typeof outputMount, 'string');
assert.ok(previousMount);
assert.ok(outputMount);
/** Previous fixture remains outside the output mount even when device identifiers agree. */
const previous = await mkdtemp(join(previousMount, 'reuse-prior-'));
/** New fixture never replaces a real installation or another session's files. */
const output = await mkdtemp(join(outputMount, 'reuse-output-'));
/** Exact contents establish that storage sharing is an eligible optimization. */
const content = 'verified immutable release bytes\n';
/** Filename is passed directly to filesystem APIs, including its shell delimiters. */
const filename = 'release "quote" ; $.txt';
await writeFile(join(previous, filename), content);
await writeFile(join(output, filename), content);

await describe({
  name: 'immutable native release reuse on separate mounts',
  children: [
    it({
      name: 'proves equal device identifiers do not establish hard-link availability',
      fn: async function verifyMountBoundary() {
        /** Identical device identifiers pass the production metadata eligibility check. */
        const prior = await stat(join(previous, filename));
        /** Newly verified target has independent storage before reuse. */
        const target = await stat(join(output, filename));
        assert.equal(prior.dev, target.dev);
        assert.notEqual(prior.ino, target.ino);
        assert.equal(prior.mode, target.mode);
        assert.equal(prior.size, target.size);
        await assert.rejects(link(join(previous, filename), join(output, 'cross-mount-control')), { code: 'EXDEV' });
      },
    }),
    it({
      name: 'retains complete verified output when immutable sharing returns EXDEV',
      fn: async function retainIndependentFile() {
        /** Refusal to share bytes leaves valid independently built output publishable. */
        const reused = await reuseNativeBuildFiles({ output, active: previous });
        assert.deepEqual(reused, { files: 0, bytes: 0 });
        assert.equal(await readFile(join(output, filename), 'utf8'), content);
        assert.equal(await readFile(join(previous, filename), 'utf8'), content);
        assert.deepEqual(await readdir(output), [filename]);
        assert.deepEqual(await readdir(previous), [filename]);
      },
    }),
    it({
      name: 'still shares identical files within one mount',
      fn: async function shareWithinMount() {
        /** Matching entries on one mount provide the successful-reuse positive control. */
        const sameMount = await mkdtemp(join(outputMount, 'reuse-same-mount-'));
        /** Prior directory belongs to this disposable positive control. */
        const original = join(sameMount, 'prior');
        /** Output directory shares the same mount as its prior file. */
        const target = join(sameMount, 'output');
        await mkdir(original);
        await mkdir(target);
        await writeFile(join(original, filename), content);
        await writeFile(join(target, filename), content);
        assert.deepEqual(await reuseNativeBuildFiles({ output: target, active: original }), {
          files: 1,
          bytes: Buffer.byteLength(content),
        });
        assert.equal((await stat(join(original, filename))).ino, (await stat(join(target, filename))).ino);
        assert.equal(await readFile(join(target, filename), 'utf8'), content);
      },
    }),
  ],
});
//endregion Actual mount-boundary and successful-sharing controls

import { appendFileSync, fstatSync, renameSync, truncateSync, writeFileSync, } from 'node:fs';
import { type FileHandle, chmod, copyFile, mkdir, mkdtemp, open, readFile, rm, stat, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { isAbsolute, join, relative, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createPreparationAttempt, PreparationAttemptError, verifyPreparationAttempt, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'preparation-attempt-race-test' });
const rootPlanText = JSON.stringify({ version: 1, fixture: 'x'.repeat(131_073) });

async function temporaryParent(): Promise<AsyncDisposable & { readonly dir: string; }> {
  const dir = await mkdtemp(join(tmpdir(), 'preparation-attempt-race-'));
  return { dir,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

// The Node process belongs to this file; serialize its prototype interception and cwd control.
await describe({ name: 'observed namespace stability controls', concurrency: 1, children: [
  ...['append', 'truncate', 'same-size', 'replace-identically'].map(mode => it({
    name: `refuses ${mode} during the actual root-plan stream`, fn: async ctx => {
      await using parent = await temporaryParent();
      const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
      const path = join(attempt.dir, 'root-plan.json');
      const originalStat = await stat(path, { bigint: true });
      const replacement = join(parent.dir, 'replacement.json');
      await copyFile(path, replacement);
      await chmod(replacement, 0o600);
      await using probe = await open(join(parent.dir, 'prototype-probe'), 'wx');
      const prototype = Object.getPrototypeOf(probe) as Pick<FileHandle, 'createReadStream'>;
      const native = prototype.createReadStream;
      let changes = 0;
      let bytesSeen = 0;
      ctx.sinon.stub(prototype, 'createReadStream').callsFake(function observedStream(this: FileHandle, options) {
        const stream = native.call(this, options);
        if (fstatSync(this.fd, { bigint: true }).ino === originalStat.ino) {
          stream.on('data', (chunk: unknown) => {
            if (!Buffer.isBuffer(chunk)) throw new Error('expected native byte stream');
            bytesSeen += chunk.length;
          });
          stream.once('data', () => {
            changes += 1;
            if (mode === 'append') appendFileSync(path, 'appended after initial stat');
            else if (mode === 'truncate') truncateSync(path, Math.floor(attempt.rootPlanBytes / 2));
            else if (mode === 'same-size') writeFileSync(path, rootPlanText.replace('x"}', 'y"}'));
            else renameSync(replacement, path);
          });
        }
        return stream;
      });
      let caught: unknown;
      try {
        await verifyPreparationAttempt({ expected: attempt, l });
      }
      catch (error) { caught = error; }
      expect(changes).toBe(1);
      expect(caught).toBeInstanceOf(PreparationAttemptError);
      expect((caught as PreparationAttemptError).operation).toBe('read-plan');
      if (mode === 'append') expect(bytesSeen).toBe(attempt.rootPlanBytes);
    },
  })),
  it({ name: 'rejects a plan one byte beyond its independent extent before opening its content stream', fn: async ctx => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    const path = join(attempt.dir, 'root-plan.json');
    const planStat = await stat(path, { bigint: true });
    appendFileSync(path, ' ');
    await using probe = await open(join(parent.dir, 'prototype-probe'), 'wx');
    const prototype = Object.getPrototypeOf(probe) as Pick<FileHandle, 'createReadStream'>;
    const native = prototype.createReadStream;
    let planStreams = 0;
    ctx.sinon.stub(prototype, 'createReadStream').callsFake(function observedStream(this: FileHandle, options) {
      if (fstatSync(this.fd, { bigint: true }).ino === planStat.ino) planStreams += 1;
      return native.call(this, options);
    });
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: attempt, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('read-plan');
    expect(planStreams).toBe(0);
  } }),
  it({ name: 'refuses the marker before touching an invalid root-plan path', fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    const markerPath = join(attempt.dir, 'attempt.json');
    const marker = await readFile(markerPath, 'utf8');
    await writeFile(markerPath, marker.replace('preparation-attempt', 'preparation-altered'));
    await rm(join(attempt.dir, 'root-plan.json'));
    await mkdir(join(attempt.dir, 'root-plan.json'), { mode: 0o700 });
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: attempt, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('read-identity');
  } }),
  it({ name: 'pins relative namespace paths before an asynchronous cwd change', fn: async () => {
    await using parent = await temporaryParent();
    const originalCwd = process.cwd();
    const attempt = await createPreparationAttempt({ parentDir: relative(originalCwd, parent.dir), rootPlanText, l });
    expect(isAbsolute(attempt.dir)).toBe(true);
    const relativeDir = relative(originalCwd, attempt.dir);
    const pending = verifyPreparationAttempt({ expected: { ...attempt, dir: relativeDir }, l });
    using _restore = {
      [Symbol.dispose](): void {
        process.chdir(originalCwd);
      },
    };
    process.chdir(parent.dir);
    const [verification] = await Promise.allSettled([pending]);
    expect(verification?.status).toBe('fulfilled');
    expect(process.cwd()).not.toBe(originalCwd);
  } }),
  ...[
    { attemptId: 'x'.repeat(36) },
    { attemptId: '00000000-0000-5000-8000-000000000000' },
    { attemptId: '00000000-0000-4000-7000-000000000000' },
    { rootPlanDigest: 'g'.repeat(64) },
    { rootPlanDigest: 'a'.repeat(63) },
  ].map((changed, index) => it({ name: `rejects noncanonical independent identity ${index}`, fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: { ...attempt, ...changed }, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('identity');
  } })),
  ...[0, 1, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1].map(rootPlanBytes => it({
    name: `rejects noncanonical independent extent ${String(rootPlanBytes)}`, fn: async () => {
      await using parent = await temporaryParent();
      const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
      let caught: unknown;
      try {
        await verifyPreparationAttempt({ expected: { ...attempt, rootPlanBytes }, l });
      }
      catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(PreparationAttemptError);
      expect((caught as PreparationAttemptError).operation).toBe('identity');
    },
  })),
] });

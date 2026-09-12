import { type FileHandle, mkdtemp, open, readFile, rm, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { setImmediate, } from 'node:timers/promises';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createPreparationAttempt, type PreparationAttemptFile, type PreparationAttemptStorage, preparationAttemptStorage, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'preparation-attempt-order-test' });

async function temporaryParent(): Promise<AsyncDisposable & { readonly dir: string; }> {
  const dir = await mkdtemp(join(tmpdir(), 'preparation-attempt-order-'));
  return { dir,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

// Files are separate Node processes under mise. Serialize this file's native FileHandle prototype spy.
await describe({ name: 'preparation namespace write completion boundaries', concurrency: 1, children: [
  it({ name: 'waits for the root write before identity work and for identity write before returning', fn: async () => {
    await using parent = await temporaryParent();
    const rootPlanText = '{"fixture":"ordered writes"}';
    const planEntered = Promise.withResolvers<void>();
    const planReleased = Promise.withResolvers<void>();
    const identityEntered = Promise.withResolvers<void>();
    const identityReleased = Promise.withResolvers<void>();
    const writes: Promise<void>[] = [];
    const started: PreparationAttemptFile[] = [];
    const completed: PreparationAttemptFile[] = [];
    async function completeWrite(args: Parameters<PreparationAttemptStorage['write']>[0]): Promise<void> {
      started.push(args.file);
      if (args.file === 'root-plan.json') {
        planEntered.resolve();
        await planReleased.promise;
      }
      else {
        identityEntered.resolve();
        await identityReleased.promise;
      }
      await preparationAttemptStorage.write(args);
      completed.push(args.file);
    }
    async function controlledWrite(args: Parameters<PreparationAttemptStorage['write']>[0]): Promise<void> {
      const writing = completeWrite(args);
      writes.push(writing);
      await writing;
    }
    const pending = createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l,
      storage: { allocate: preparationAttemptStorage.allocate, write: controlledWrite } });
    let returned = false;
    async function observeReturn(): Promise<void> {
      await pending;
      returned = true;
    }
    const observed = observeReturn();
    await using _release = {
      async [Symbol.asyncDispose](): Promise<void> {
        planReleased.resolve();
        identityReleased.resolve();
        await Promise.all(writes);
        await observed;
      },
    };
    await planEntered.promise;
    await setImmediate();
    expect(started).toEqual(['root-plan.json']);
    expect(completed).toEqual([]);
    expect(returned).toBe(false);
    planReleased.resolve();
    await identityEntered.promise;
    await setImmediate();
    expect(started).toEqual(['root-plan.json', 'attempt.json']);
    expect(completed).toEqual(['root-plan.json']);
    expect(returned).toBe(false);
    identityReleased.resolve();
    await observed;
    expect(returned).toBe(true);
  } }),
  it({ name: 'invokes native file-content sync on the newly opened handle', fn: async ctx => {
    await using parent = await temporaryParent();
    await using probe = await open(join(parent.dir, 'sync-probe'), 'wx');
    const prototype = Object.getPrototypeOf(probe) as Pick<FileHandle, 'sync'>;
    const sync = ctx.sinon.spy(prototype, 'sync');
    await probe.sync();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync.firstCall.thisValue).toBe(probe);
    sync.resetHistory();
    await preparationAttemptStorage.write({ dir: parent.dir, file: 'root-plan.json', text: 'native sync fixture' });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync.firstCall.thisValue).not.toBe(probe);
    expect(await readFile(join(parent.dir, 'root-plan.json'), 'utf8')).toBe('native sync fixture');
  } }),
  it({ name: 'awaits native handle sync completion rather than merely invoking it', fn: async ctx => {
    await using parent = await temporaryParent();
    await using probe = await open(join(parent.dir, 'sync-probe'), 'wx');
    const prototype = Object.getPrototypeOf(probe) as Pick<FileHandle, 'sync' | typeof Symbol.asyncDispose>;
    const disposal = ctx.sinon.spy(prototype, Symbol.asyncDispose);
    async function disposeWitness(): Promise<void> {
      await using witness = await open(join(parent.dir, 'disposal-witness'), 'wx');
      expect(witness.fd).toBeGreaterThan(-1);
    }
    await disposeWitness();
    expect(disposal.callCount).toBe(1);
    disposal.resetHistory();
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const finished = Promise.withResolvers<void>();
    let called = false;
    ctx.sinon.stub(prototype, 'sync').callsFake(async (): Promise<void> => {
      called = true;
      entered.resolve();
      await released.promise;
      finished.resolve();
    });
    const writing = preparationAttemptStorage.write({ dir: parent.dir, file: 'root-plan.json', text: 'blocked sync fixture' });
    let returned = false;
    async function observeWrite(): Promise<'returned'> {
      await writing;
      returned = true;
      return 'returned';
    }
    async function observeEntry(): Promise<'entered'> {
      await entered.promise;
      return 'entered';
    }
    const observed = observeWrite();
    await using _release = {
      async [Symbol.asyncDispose](): Promise<void> {
        released.resolve();
        entered.resolve();
        await writing;
        if (called) await finished.promise;
      },
    };
    expect(await Promise.race([observeEntry(), observed])).toBe('entered');
    await setImmediate();
    expect(disposal.callCount).toBe(0);
    expect(returned).toBe(false);
    released.resolve();
    await observed;
    expect(returned).toBe(true);
    expect(disposal.callCount).toBe(1);
  } }),
] });

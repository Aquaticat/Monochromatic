import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile, } from 'node:fs/promises';
import { createHash, } from 'node:crypto';
import { inspect, } from 'node:util';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  createPreparationAttempt,
  PreparationAttemptError,
  type PreparationAttemptFile,
  type PreparationAttemptStorage,
  preparationAttemptStorage,
} from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'preparation-attempt-namespace-test' });
const rootPlanText = `${JSON.stringify({ version: 1, fixture: '猫 "quoted" \\ path', slots: [] }, undefined, 2).replaceAll('\n', '\r\n')  }\r\n`;

async function temporaryParent(): Promise<AsyncDisposable & { readonly dir: string; }> {
  const dir = await mkdtemp(join(tmpdir(), 'preparation-attempt-test-'));
  return { dir,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

await describe({ name: createPreparationAttempt.name, children: [
  it({ name: 'writes exact plan bytes before a matching identity marker in a private fresh directory', fn: async () => {
    await using parent = await temporaryParent();
    const order: string[] = [];
    const storage: PreparationAttemptStorage = { allocate: preparationAttemptStorage.allocate,
      write: async args => {
        order.push(args.file);
        if (args.file === 'attempt.json') {
          expect(await readFile(join(args.dir, 'root-plan.json'), 'utf8')).toBe(rootPlanText);
          expect(await readdir(args.dir)).toEqual(['root-plan.json']);
        }
        await preparationAttemptStorage.write(args);
      },
    };
    const result = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, storage, l });
    expect(order).toEqual(['root-plan.json', 'attempt.json']);
    expect(await readFile(join(result.dir, 'root-plan.json'), 'utf8')).toBe(rootPlanText);
    const storedBytes = await readFile(join(result.dir, 'root-plan.json'));
    expect(result.rootPlanDigest).toBe(createHash('sha256').update(storedBytes).digest('hex'));
    expect(
      JSON.parse(await readFile(join(result.dir, 'attempt.json'), 'utf8')),
    ).toEqual({ version: 1, kind: 'preparation-attempt', attemptId: result.attemptId, rootPlanDigest: result.rootPlanDigest });
    expect((await stat(result.dir)).mode & 0o077).toBe(0);
    expect((await stat(join(result.dir, 'root-plan.json'))).mode & 0o077).toBe(0);
    expect((await stat(join(result.dir, 'attempt.json'))).mode & 0o077).toBe(0);
    expect(Object.keys(result).toSorted()).toEqual(['attemptId', 'dir', 'rootPlanDigest']);
  } }),
  it({ name: 'allocates independent namespaces concurrently and never resumes an incomplete prior directory', fn: async () => {
    await using parent = await temporaryParent();
    const abandoned = join(parent.dir, 'preparation-abandoned');
    await mkdir(abandoned);
    await writeFile(join(abandoned, 'partial-plan'), 'retained incomplete fixture');
    const attempts = await Promise.all([0, 1, 2].map(async () => await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l })));
    expect(new Set(attempts.map(attempt => attempt.dir)).size).toBe(3);
    expect(new Set(attempts.map(attempt => attempt.attemptId)).size).toBe(3);
    expect(new Set(attempts.map(attempt => attempt.rootPlanDigest)).size).toBe(1);
    expect(await readFile(join(abandoned, 'partial-plan'), 'utf8')).toBe('retained incomplete fixture');
    expect(await readdir(parent.dir)).toHaveLength(4);
  } }),
  ...['private-fixture-invalid-plan', '[]', 'null', '1', '"text"'].map(text => it({ name: `rejects non-object plan syntax ${text} before any allocation`, fn: async () => {
    await using parent = await temporaryParent();
    const calls: string[] = [];
    let caught: unknown;
    try {
      await createPreparationAttempt({ parentDir: parent.dir, rootPlanText: text, l, storage: {
        allocate: async args => {
          calls.push('allocate');
          return await preparationAttemptStorage.allocate(args);
        },
        write: preparationAttemptStorage.write,
      } });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('plan-syntax');
    expect((caught as Error).message).not.toContain('private-fixture-invalid-plan');
    expect(inspect(caught, { depth: null })).not.toContain('private-fixture-invalid-plan');
    expect(calls).toEqual([]);
    expect(await readdir(parent.dir)).toEqual([]);
  } })),
  it({ name: 'reports native directory allocation failure without inventing a created attempt', fn: async () => {
    await using parent = await temporaryParent();
    const file = join(parent.dir, 'not-a-directory');
    await writeFile(file, 'owned fixture');
    let caught: unknown;
    try {
      await createPreparationAttempt({ parentDir: file, rootPlanText, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('create-directory');
    expect((caught as PreparationAttemptError).dir).toBe(file);
    expect(await readFile(file, 'utf8')).toBe('owned fixture');
  } }),
  it({ name: 'wraps an injected allocation failure while retaining an already contextualized one', fn: async () => {
    await using parent = await temporaryParent();
    const reason = new Error('allocation fixture');
    const contextual = new PreparationAttemptError({ operation: 'create-directory', dir: parent.dir, cause: reason });
    const outcomes = await Promise.allSettled([reason, contextual].map(error => createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l,
      storage: { allocate: (): never => { throw error; }, write: preparationAttemptStorage.write } })));
    const [raw, named] = outcomes;
    if ((raw?.status !== 'rejected') || (named?.status !== 'rejected')) throw new Error('expected allocation refusals');
    expect(raw.reason).toBeInstanceOf(PreparationAttemptError);
    expect((raw.reason as Error).cause).toBe(reason);
    expect(named.reason).toBe(contextual);
    expect(await readdir(parent.dir)).toEqual([]);
  } }),
  it({ name: 'retains a partial root plan and never writes the identity marker after a plan write fails', fn: async () => {
    await using parent = await temporaryParent();
    const reason = new Error('partial plan write fixture');
    let caught: unknown;
    try {
      await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l, storage: {
        allocate: preparationAttemptStorage.allocate,
        write: async args => {
          await writeFile(join(args.dir, args.file), '{"partial":', { flag: 'wx' });
          throw reason;
        },
      } });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    const failure = caught as PreparationAttemptError;
    expect(failure.operation).toBe('write-plan');
    expect(failure.cause).toBe(reason);
    expect(await readdir(failure.dir)).toEqual(['root-plan.json']);
    expect(await readFile(join(failure.dir, 'root-plan.json'), 'utf8')).toBe('{"partial":');
  } }),
  it({ name: 'retains a complete plan without claiming success after identity-marker failure', fn: async () => {
    await using parent = await temporaryParent();
    const reason = new Error('identity write fixture');
    let caught: unknown;
    try {
      await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l, storage: {
        allocate: preparationAttemptStorage.allocate,
        write: async args => {
          if (args.file === 'attempt.json') throw reason;
          await preparationAttemptStorage.write(args);
        },
      } });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    const failure = caught as PreparationAttemptError;
    expect(failure.operation).toBe('write-identity');
    expect(failure.cause).toBe(reason);
    expect(await readdir(failure.dir)).toEqual(['root-plan.json']);
    expect(await readFile(join(failure.dir, 'root-plan.json'), 'utf8')).toBe(rootPlanText);
  } }),
  it({ name: 'retains partial identity bytes and the complete root plan after a marker write fails', fn: async () => {
    await using parent = await temporaryParent();
    const reason = new Error('partial identity write fixture');
    let caught: unknown;
    try {
      await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l, storage: {
        allocate: preparationAttemptStorage.allocate,
        write: async args => {
          if (args.file === 'attempt.json') {
            await writeFile(join(args.dir, args.file), '{"version":', { flag: 'wx' });
            throw reason;
          }
          await preparationAttemptStorage.write(args);
        },
      } });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    const failure = caught as PreparationAttemptError;
    expect(failure.operation).toBe('write-identity');
    expect(failure.cause).toBe(reason);
    expect(await readFile(join(failure.dir, 'root-plan.json'), 'utf8')).toBe(rootPlanText);
    expect(await readFile(join(failure.dir, 'attempt.json'), 'utf8')).toBe('{"version":');
  } }),
  it({ name: 'never replaces an existing namespace file and allows only one competing exclusive write', fn: async () => {
    await using parent = await temporaryParent();
    const outcomes = await Promise.allSettled(['first', 'second'].map(text => preparationAttemptStorage.write({ dir: parent.dir, file: 'root-plan.json', text })));
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
    const written = await readFile(join(parent.dir, 'root-plan.json'), 'utf8');
    expect(['first', 'second']).toContain(written);
    const [overwrite] = await Promise.allSettled([preparationAttemptStorage.write({ dir: parent.dir, file: 'root-plan.json', text: 'overwrite' })]);
    expect(overwrite?.status).toBe('rejected');
    expect(await readFile(join(parent.dir, 'root-plan.json'), 'utf8')).toBe(written);
  } }),
  it({ name: 'rejects runtime filename traversal before writing outside the namespace', fn: async () => {
    await using parent = await temporaryParent();
    const dir = join(parent.dir, 'namespace');
    await mkdir(dir);
    const [outcome] = await Promise.allSettled([preparationAttemptStorage.write({ dir, file: '../escaped.json' as PreparationAttemptFile, text: 'must not be written' })]);
    expect(outcome?.status).toBe('rejected');
    if (outcome?.status !== 'rejected') throw new Error('expected filename refusal');
    expect(outcome.reason).toBeInstanceOf(PreparationAttemptError);
    expect((outcome.reason as PreparationAttemptError).operation).toBe('file-name');
    expect(await readdir(parent.dir)).toEqual(['namespace']);
    expect(await readdir(dir)).toEqual([]);
  } }),
] });

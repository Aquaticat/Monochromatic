import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { inspect, } from 'node:util';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createPreparationAttempt, PreparationAttemptError, verifyPreparationAttempt, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'verify-preparation-attempt-test' });
const rootPlanText = JSON.stringify({ version: 1, fixture: '猫 "quoted" \\ path', slots: [] });

async function temporaryParent(): Promise<AsyncDisposable & { readonly dir: string; }> {
  const dir = await mkdtemp(join(tmpdir(), 'preparation-attempt-verify-'));
  return { dir,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

await describe({ name: verifyPreparationAttempt.name, children: [
  it({ name: 'verifies a real namespace without modifying files or granting phase authority', fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    const marker = await readFile(join(attempt.dir, 'attempt.json'));
    const [verification] = await Promise.allSettled([verifyPreparationAttempt({ expected: attempt, l })]);
    expect(verification?.status).toBe('fulfilled');
    if (verification?.status !== 'fulfilled') throw new Error('expected valid namespace verification');
    expect(verification.value).toBeUndefined();
    expect(await readFile(join(attempt.dir, 'root-plan.json'), 'utf8')).toBe(rootPlanText);
    expect(await readFile(join(attempt.dir, 'attempt.json'))).toEqual(marker);
    expect((await readdir(attempt.dir)).toSorted()).toEqual(['attempt.json', 'root-plan.json']);
  } }),
  ...(['attemptId', 'rootPlanDigest'] as const).map(field => it({ name: `uses independent expected ${field}, not the marker's assertion`, fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: { ...attempt, [field]: '0'.repeat(attempt[field].length) }, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('read-identity');
  } })),
  ...['dir', 'attemptId', 'rootPlanDigest'].map(field => it({ name: `refuses absent ${field} before reading namespace files`, fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: { ...attempt, [field]: '' }, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('identity');
  } })),
  ...['root-plan.json', 'attempt.json'].map(file => it({ name: `refuses missing, partial or changed ${file}`, fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    await writeFile(join(attempt.dir, file), 'private-namespace-canary');
    let changed: unknown;
    try {
      await verifyPreparationAttempt({ expected: attempt, l });
    }
    catch (error) { changed = error; }
    expect(changed).toBeInstanceOf(PreparationAttemptError);
    expect((changed as PreparationAttemptError).operation).toBe(file === 'root-plan.json' ? 'read-plan' : 'read-identity');
    expect(inspect(changed, { depth: null })).not.toContain('private-namespace-canary');
    await rm(join(attempt.dir, file));
    let missing: unknown;
    try {
      await verifyPreparationAttempt({ expected: attempt, l });
    }
    catch (error) { missing = error; }
    expect(missing).toBeInstanceOf(PreparationAttemptError);
    expect((missing as PreparationAttemptError).operation).toBe(file === 'root-plan.json' ? 'read-plan' : 'read-identity');
  } })),
  ...['root-plan.json', 'attempt.json'].map(file => it({ name: `refuses an identical-content ${file} symlink rather than following it`, fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    const outside = join(parent.dir, `outside-${file}`);
    await copyFile(join(attempt.dir, file), outside);
    await chmod(outside, 0o600);
    await rm(join(attempt.dir, file));
    await symlink(outside, join(attempt.dir, file));
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: attempt, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe(file === 'root-plan.json' ? 'read-plan' : 'read-identity');
  } })),
  it({ name: 'refuses a directory symlink even when its target contains exactly the expected namespace', fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    const link = join(parent.dir, 'namespace-link');
    await symlink(attempt.dir, link, 'dir');
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: { ...attempt, dir: link }, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('read-directory');
  } }),
  ...['directory', 'root-plan.json', 'attempt.json'].map(kind => it({ name: `refuses non-private ${kind} access`, fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    await chmod(kind === 'directory' ? attempt.dir : join(attempt.dir, kind), kind === 'directory' ? 0o755 : 0o644);
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: attempt, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe(kind === 'directory' ? 'read-directory' : kind === 'root-plan.json' ? 'read-plan' : 'read-identity');
  } })),
  it({ name: 'refuses a non-file at a fixed namespace filename', fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    await rm(join(attempt.dir, 'root-plan.json'));
    await mkdir(join(attempt.dir, 'root-plan.json'), { mode: 0o700 });
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: attempt, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('read-plan');
  } }),
  it({ name: 'hashes all chunks of a plan rather than only the prefix', fn: async () => {
    await using parent = await temporaryParent();
    const text = JSON.stringify({ fixture: 'x'.repeat(131_073) });
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText: text, l });
    const [initial] = await Promise.allSettled([verifyPreparationAttempt({ expected: attempt, l })]);
    expect(initial?.status).toBe('fulfilled');
    await writeFile(join(attempt.dir, 'root-plan.json'), text.replace('x"}', 'y"}'));
    let caught: unknown;
    try {
      await verifyPreparationAttempt({ expected: attempt, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationAttemptError);
    expect((caught as PreparationAttemptError).operation).toBe('read-plan');
  } }),
  it({ name: 'snapshots primitive expectations before asynchronous reads', fn: async () => {
    await using parent = await temporaryParent();
    const attempt = await createPreparationAttempt({ parentDir: parent.dir, rootPlanText, l });
    const mutable = { ...attempt };
    const pending = verifyPreparationAttempt({ expected: mutable, l });
    mutable.attemptId = 'changed-after-entry';
    mutable.rootPlanDigest = 'changed-after-entry';
    await pending;
    expect(mutable.attemptId).not.toBe(attempt.attemptId);
  } }),
] });

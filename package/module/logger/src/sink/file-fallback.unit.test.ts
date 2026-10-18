/** Exercise default fallback and strict explicit destinations through built Node consumers. @module */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from '@monochromatic-dev/module-test/ts';

//region Disposable consumers isolate home, cwd and inherited destination overrides.
/** Create a fixture outside the repository so ancestor discovery has a genuine miss control. */
async function workspace() {
  const scratch = join(homedir(), 'temp', 'agent');
  await mkdir(scratch, { recursive: true, mode: 0o700 });
  await chmod(scratch, 0o700);
  const path = await mkdtemp(join(scratch, 'logger-fallback-'));
  return { path, async [Symbol.asyncDispose]() {
    await rm(path, { recursive: true });
  } };
}

/**
 Run the published sink boundary with isolated environment and capture every shutdown diagnostic.

 @param cwd - disposable project or directory without a project
 @param home - disposable user home
 @param state - isolated state root, including invalid relative-path controls
 @param directory - explicit destination, or empty default-discovery control
 @param available - expected result shared by concurrent verification calls
 */
async function consume({ cwd, home, state, directory = '', available = true }: {
  readonly cwd: string;
  readonly home: string;
  readonly state: string;
  readonly directory?: string;
  readonly available?: boolean;
}): Promise<string> {
  const source = `import assert from 'node:assert/strict';
import {createFileSink} from ${JSON.stringify(new URL('../../dist/final/node/node.mjs', import.meta.url).href)};
const sink=createFileSink();const first=sink.verify();assert.equal(first,sink.verify());
assert.equal(await first,${String(available)});
await sink.write({level:'info',timestamp:0,message:'fallback persisted control'});`;
  const child = spawn(process.execPath, ['--max-old-space-size=128', '--input-type=module', '--eval', source], {
    cwd,
    env: { ...process.env, HOME: home, XDG_STATE_HOME: state, MONOCHROMATIC_LOG_DIRECTORY: directory },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const errors: Buffer[] = [];
  child.stderr.on('data', function capture(chunk: Buffer): void {
    errors.push(chunk);
  });
  const [code, signal]: unknown[] = await once(child, 'close');
  const stderr = Buffer.concat(errors).toString();
  assert.equal(code, 0, stderr);
  assert.equal(signal, null);
  return stderr;
}

/** Verify actual JSONL records and exactly one sink-owned file after concurrent verification. */
async function checkRecords(directory: string): Promise<void> {
  const files = await readdir(directory);
  assert.equal(files.length, 1);
  const [name] = files;
  assert.equal(typeof name, 'string');
  if (name === undefined) throw new Error('Missing sink-owned log file');
  const lines = (await readFile(join(directory, name), 'utf8')).trim().split('\n');
  const values: unknown[] = lines.map(function parse(line) { return JSON.parse(line); });
  assert.ok(values.some(function isRecord(value) {
    return typeof value === 'object' && value !== null && 'message' in value
      && value.message === 'fallback persisted control';
  }));
}
//endregion

//region Filesystem failures cannot silently change an explicit destination.
await describe({ name: 'file sink default fallback', children: [
  it({ name: 'keeps a writable project destination and emits no fallback notice', fn: async function projectControl() {
    await using fixture = await workspace();
    await mkdir(join(fixture.path, 'node_modules'));
    const stderr = await consume({ cwd: fixture.path, home: fixture.path, state: join(fixture.path, 'state') });
    assert.equal(stderr, '');
    await checkRecords(join(fixture.path, 'node_modules', '.monochromatic'));
  } }),
  it({ name: 'persists records in user state after project creation fails and reports that destination once', fn: async function projectFailure() {
    await using fixture = await workspace();
    await mkdir(join(fixture.path, 'node_modules'));
    await writeFile(join(fixture.path, 'node_modules', '.monochromatic'), 'occupied');
    const state = join(fixture.path, 'state');
    const stderr = await consume({ cwd: fixture.path, home: fixture.path, state });
    const destination = join(state, 'monochromatic', 'log');
    assert.ok(stderr.includes(JSON.stringify(destination)), stderr);
    assert.equal(stderr.trim().split('\n').length, 1);
    await checkRecords(destination);
  } }),
  it({ name: 'uses the default user state root when no project exists and ignores relative XDG state paths', fn: async function noProject() {
    await using fixture = await workspace();
    const stderr = await consume({ cwd: fixture.path, home: fixture.path, state: 'relative-state' });
    const destination = join(fixture.path, '.local', 'state', 'monochromatic', 'log');
    assert.ok(stderr.includes(JSON.stringify(destination)), stderr);
    await checkRecords(destination);
  } }),
  it({ name: 'reports an explicit destination failure without falling back', fn: async function explicitFailure() {
    await using fixture = await workspace();
    const directory = join(fixture.path, 'occupied');
    await writeFile(directory, 'occupied');
    const state = join(fixture.path, 'state');
    const stderr = await consume({ cwd: fixture.path, home: fixture.path, state, directory, available: false });
    assert.ok(stderr.includes('file sink verification failed'), stderr);
    assert.equal(stderr.includes('using fallback'), false);
    assert.equal((await readdir(fixture.path)).includes('state'), false);
  } }),
  it({ name: 'reports unavailable user state and leaves the sink unavailable', fn: async function fallbackFailure() {
    await using fixture = await workspace();
    const state = join(fixture.path, 'occupied');
    await writeFile(state, 'occupied');
    const stderr = await consume({ cwd: fixture.path, home: fixture.path, state, available: false });
    assert.ok(stderr.includes('file sink verification failed'), stderr);
    assert.equal(stderr.includes('using fallback'), false);
  } }),
] });
//endregion

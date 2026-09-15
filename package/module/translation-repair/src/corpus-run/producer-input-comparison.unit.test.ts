import { createHash, } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, promises as fsPromises, watch, } from 'node:fs';
import childProcess from 'node:child_process';
import events, { getEventListeners, } from 'node:events';
import { syncBuiltinESMExports, } from 'node:module';
import timers from 'node:timers';
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { ProducerInputComparisonError, runProducerInputComparison, } from '../../dist/final/node/producer-input-comparison.mjs';

const l = tagged({ tag: 'input-comparison-consumer-test' });
l.info(`comparison test entry runtime ${process.version} at ${process.execPath}`);
const identity = (bytes: Uint8Array) => ({ bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') });
const nodeIdentity = identity(await readFile(process.execPath));
const artifactText = JSON.stringify({ scope: 'unqualified-preparation-root-inputs', fixture: '猫🐾' });
const artifactIdentity = identity(Buffer.from(artifactText));
const CORRUPT_OPENING_BYTE = 0x5B;

function recordValue(value: unknown): Readonly<Record<string, unknown>> {
  if (((typeof value) !== 'object') || (value === null) || Array.isArray(value)) throw new Error('Expected fixture record');
  return Object.fromEntries(Object.entries(value));
}
async function readRecord(path: string): Promise<Readonly<Record<string, unknown>>> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  return recordValue(value);
}
function text(value: unknown): string {
  if ((typeof value) !== 'string') throw new Error('Expected fixture text');
  return value;
}
function textList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new Error('Expected fixture string list');
  const entries: readonly unknown[] = value;
  return entries.map(text);
}

type Mode = 'normal' | 'exit-before-output' | 'exit-after-output' | 'malformed-stdout' | 'wrong-stdout-directory' | 'extra-stdout-key' | 'extra-child' | 'no-child' | 'child-file' | 'bad-run-id' | 'extra-output' | 'home-content' | 'artifact-mode' | 'artifact-hash' | 'wrong-completion-run' | 'wrong-completion-launch' | 'extra-completion-key' | 'wrong-created-launch' | 'wrong-created-owner' | 'wrong-verified-completion' | 'cleanup-interrupted' | 'stderr-on-success' | 'wait-after-output' | 'comparison-collision' | 'failure-collision' | 'ignore-term-after-output' | 'stdout-mode' | 'stderr-mode' | 'stdout-replacement' | 'stderr-replacement' | 'wrong-created-group' | 'input-directory-mode' | 'output-directory-mode' | 'home-directory-mode' | 'output-directory-symlink' | 'artifact-symlink';

async function fixture(mode: Mode = 'normal') {
  const directory = await mkdtemp(join(tmpdir(), "input-comparison-'quoted'-"));
  const runtime = join(directory, 'runtime');
  const supporting = join(directory, 'supporting');
  const corpus = join(directory, 'corpus');
  const output = join(directory, 'output');
  await Promise.all([runtime, supporting, corpus, output].map(path => mkdir(path, { mode: 0o700 })));
  const behaviorPath = join(directory, 'behavior.json');
  await writeFile(behaviorPath, JSON.stringify({ mode, artifactText }));
  const bootstrapPath = join(directory, 'producer-prepare.mjs');
  // Every fixture path crosses into generated JavaScript through JSON encoding, not shell interpolation.
  const script = `import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {chmod,mkdir,readFile,rename,symlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
const args=process.argv.slice(2);
const at=name=>args[args.indexOf(name)+1];
const raw=await readFile(at('--launch'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(raw),at('--launch-sha256'));
assert.equal(raw.length,Number(at('--launch-bytes')));
const launch=JSON.parse(raw);
const {mode,artifactText}=JSON.parse(await readFile(${JSON.stringify(behaviorPath)},'utf8'));
await writeFile(join(process.cwd(),'invoked.json'),JSON.stringify({argv:args,environmentKeys:Object.keys(process.env)}),{mode:0o600,flag:'wx'});
if(mode==='comparison-collision')await writeFile(join(process.cwd(),'comparison.json'),'existing comparison q7z9k2',{mode:0o600,flag:'wx'});
if(mode==='failure-collision')await writeFile(join(process.cwd(),'failure.json'),'existing failure q7z9k2',{mode:0o600,flag:'wx'});
if(mode==='exit-before-output')process.exitCode=6;
else if(mode==='no-child')console.log('{}');
else if(mode==='child-file'){await writeFile(join(launch.outputParent,'unexpected-file'),'fixture');console.log('{}');}
else {
 const runId=mode==='bad-run-id'?'not-a-uuid':randomUUID();
 const directory=join(launch.outputParent,'producer-input-'+runId);
 const output=join(directory,'output');
 await mkdir(join(output,'home'),{recursive:true,mode:0o700});
 await chmod(directory,0o700);
 await chmod(output,0o700);
 const artifactPath=join(output,'unqualified-inputs.json');
 await writeFile(artifactPath,mode==='artifact-hash'?artifactText+' ':artifactText,{mode:mode==='artifact-mode'?0o644:0o600});
 const completion={version:1,kind:'producer-preparation-input-complete',runId,launchSha256:sha(raw),artifact:{file:'unqualified-inputs.json',bytes:Buffer.byteLength(artifactText),sha256:sha(Buffer.from(artifactText))},parentCount:40,registrationCount:45};
 if(mode==='wrong-completion-run')completion.runId=randomUUID();
 if(mode==='wrong-completion-launch')completion.launchSha256='0'.repeat(64);
 if(mode==='extra-completion-key')completion.approved=true;
 await writeFile(join(output,'complete.json'),JSON.stringify(completion),{mode:0o600});
 await writeFile(join(directory,'verified-completion.json'),JSON.stringify(mode==='wrong-verified-completion'?{...completion,parentCount:39}:completion),{mode:0o600});
 await writeFile(join(directory,'launch.json'),raw,{mode:0o600});
 await writeFile(join(directory,'created.json'),JSON.stringify({version:1,kind:'producer-preparation-input-created',runId,launchSha256:mode==='wrong-created-launch'?'0'.repeat(64):sha(raw),launchBytes:raw.length,uid:mode==='wrong-created-owner'?process.getuid()+1:process.getuid(),gid:mode==='wrong-created-group'?process.getgid()+1:process.getgid()}),{mode:0o600});
 await writeFile(join(directory,'cleanup-complete.json'),JSON.stringify({version:1,kind:'producer-preparation-input-cleanup-complete',runId,containerId:'a'.repeat(64),removed:true,absenceChecked:true,interrupted:mode==='cleanup-interrupted'}),{mode:0o600});
 if(mode==='extra-child')await mkdir(join(launch.outputParent,'producer-input-'+randomUUID()),{mode:0o700});
 if(mode==='extra-output')await writeFile(join(output,'unexpected.json'),'{}',{mode:0o600});
 if(mode==='home-content')await writeFile(join(output,'home','unexpected'),'fixture',{mode:0o600});
 if(mode==='input-directory-mode')await chmod(directory,0o755);
 if(mode==='output-directory-mode')await chmod(output,0o755);
 if(mode==='home-directory-mode')await chmod(join(output,'home'),0o755);
 if(mode==='output-directory-symlink'){await rename(output,output+'.detached');await symlink(output+'.detached',output);}
 if(mode==='artifact-symlink'){const target=join(directory,'artifact.detached');await rename(artifactPath,target);await symlink(target,artifactPath);}
 if(mode==='stderr-on-success')console.error('fixture diagnostic');
 if(mode==='wait-after-output'||mode==='ignore-term-after-output'){if(mode==='ignore-term-after-output')process.on('SIGTERM',()=>{});await writeFile(join(directory,'ready.txt'),'ready',{mode:0o600});await wait(5000);}
 if(mode==='exit-after-output'||mode==='failure-collision')process.exitCode=6;
 else if(mode==='malformed-stdout')console.log('not JSON q7z9k2');
 else {
  const frame={kind:'producer-preparation-input-host-complete',directory:mode==='wrong-stdout-directory'?launch.outputParent:directory,completion,...mode==='extra-stdout-key'?{approved:true}:{}};
  const stdout=join(process.cwd(),'bootstrap.stdout');
  const stderr=join(process.cwd(),'bootstrap.stderr');
  if(mode==='stdout-mode')await chmod(stdout,0o644);
  if(mode==='stderr-mode')await chmod(stderr,0o644);
  if(mode==='stdout-replacement'){await rename(stdout,stdout+'.opened');await writeFile(stdout,JSON.stringify(frame)+'\\n',{mode:0o600,flag:'wx'});}
  if(mode==='stderr-replacement'){await rename(stderr,stderr+'.opened');await writeFile(stderr,'',{mode:0o600,flag:'wx'});}
  console.log(JSON.stringify(frame));
 }
}
`;
  await writeFile(bootstrapPath, script, { mode: 0o600 });
  // The fixture bootstrap is explicitly authenticated test code. It never loads the dummy application/native entries.
  const native = { path: 'satteri_napi.linux-x64-gnu.node', ...identity(Buffer.from('x')) };
  const manifest = { version: 1, kind: 'sealed-node-runtime-build', scope: 'application-dependencies-only', target: { platform: 'linux', arch: 'x64', libc: 'glibc' }, node: { version: process.version, versions: { ...process.versions }, executable: nodeIdentity }, native: { package: '@bruits/satteri-linux-x64-gnu', version: 'fixture', ...native }, loaderEnvironment: { policy: 'must-be-absent-before-import', names: ['NAPI_RS_NATIVE_LIBRARY_PATH', 'NAPI_RS_FORCE_WASI', 'NAPI_RS_ENFORCE_VERSION_CHECK', 'NODE_OPTIONS', 'NODE_PATH', 'NODE_ICU_DATA'] }, systemLibraries: 'Runner must separately bind its operating-system image and native shared-library inputs.', files: [native, { path: 'producer-prepare-app.mjs', ...identity(Buffer.from('fixture')) }] };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  await writeFile(join(runtime, 'sealed-runtime.json'), manifestBytes);
  const selectionPath = join(directory, 'selection.json');
  await writeFile(selectionPath, '{}');
  const base = { version: 1, kind: 'producer-preparation-input-launch', bootstrap: identity(Buffer.from(script)), podman: { path: '/usr/bin/podman', ...identity(Buffer.from('fixture-podman')) }, imageId: 'a'.repeat(64), runtime: { dir: runtime, manifest: identity(manifestBytes) }, atomicLibrary: { path: '/usr/lib64/libatomic.so.1', ...identity(Buffer.from('fixture-atomic')) }, selection: { path: selectionPath, ...identity(Buffer.from('{}')) }, supporting: { dir: supporting, maximumBytes: 1 }, corpus: { dir: corpus, commitSha: 'a'.repeat(40) }, outputParent: output };
  const baseBytes = Buffer.from(JSON.stringify(base, null, 2));
  const baseLaunchPath = join(directory, 'base-launch.json');
  await writeFile(baseLaunchPath, baseBytes);
  function request(): Parameters<typeof runProducerInputComparison>[0] {
    return { baseLaunchPath, baseLaunchIdentity: identity(baseBytes), bootstrapPath, reference: { ...artifactIdentity }, signal: new AbortController().signal, l };
  }
  return {
    directory, output, runtime, base, baseBytes, baseLaunchPath, bootstrapPath, request,
    [Symbol.asyncDispose]: async () => {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

async function accepted(request: Parameters<typeof runProducerInputComparison>[0]): Promise<Awaited<ReturnType<typeof runProducerInputComparison>>> {
  const [result] = await Promise.allSettled([runProducerInputComparison(request)]);
  expect(result?.status).toBe('fulfilled');
  if (result?.status !== 'fulfilled') throw new Error('Expected completed comparison');
  expect(Object.isFrozen(result.value.loggerCallbackFailures)).toBe(true);
  return result.value;
}

async function rejected(request: Parameters<typeof runProducerInputComparison>[0]) {
  const [result] = await Promise.allSettled([runProducerInputComparison(request)]);
  expect(result?.status).toBe('rejected');
  if (result?.status !== 'rejected') throw new Error('Expected comparison refusal');
  expect(result.reason).toBeInstanceOf(ProducerInputComparisonError);
  if (!(result.reason instanceof ProducerInputComparisonError)) throw new Error('Expected names-only comparison error');
  expect(Object.isFrozen(result.reason.loggerCallbackFailures)).toBe(true);
  return result.reason;
}

await describe({ name: runProducerInputComparison.name, concurrency: 1, children: [
  it({ name: 'derives only a private output parent and verifies persisted matched bytes through the built API', fn: async () => {
    await using f = await fixture();
    const result = await accepted(f.request());
    expect(result.scope).toBe('matched-unqualified-input-files');
    expect(result.loggerCallbackFailures).toEqual([]);
    expect(
      identity(await readFile(result.artifact.path)),
    ).toEqual(artifactIdentity);
    expect(
      await readFile(join(result.directory, 'base-launch.json')),
    ).toEqual(f.baseBytes);
    const derived = await readRecord(join(result.directory, 'derived-launch.json'));
    expect({ ...derived, outputParent: f.base.outputParent }).toEqual(f.base);
    expect(derived.outputParent).toBe(join(result.directory, 'producer-runs'));
    expect(result.derivedLaunchIdentity.sha256).not.toBe(result.baseLaunchIdentity.sha256);
    expect((await readdir(result.directory)).includes('failure.json')).toBe(false);
    const invoked = await readRecord(join(result.directory, 'invoked.json'));
    expect(invoked.environmentKeys).not.toContain('NODE_OPTIONS');
    expect(invoked.environmentKeys).not.toContain('NODE_PATH');
    expect((await readRecord(join(result.directory, 'bootstrap-observation.json'))).observation).toEqual({ status: 'fulfilled', state: 'single' });
    const comparisonRecord = await readRecord(join(result.directory, 'comparison.json'));
    expect(Object.hasOwn(comparisonRecord, 'loggerCallbackFailures')).toBe(false);
  } }),
  ...(['bytes', 'sha256'] as const).map(field => it({ name: `retains native output and comparison evidence before rejecting a reference ${field} mismatch`, fn: async () => {
    await using f = await fixture();
    const request = f.request();
    const reference = field === 'bytes' ? { ...request.reference, bytes: artifactText.length } : { ...request.reference, sha256: '0'.repeat(64) };
    expect(Buffer.byteLength(artifactText)).not.toBe(artifactText.length);
    const error = await rejected({ ...request, reference });
    expect(error.kind).toBe('mismatch');
    if (error.directory === undefined) throw new Error('Expected retained comparison directory');
    expect(await readdir(error.directory)).toContain('comparison.json');
    const comparison = await readRecord(join(error.directory, 'comparison.json'));
    expect(comparison.matches).toBe(false);
    expect(comparison.observed).toEqual(artifactIdentity);
    expect(
      identity(
        await readFile(join(text(comparison.inputRunDirectory), 'output/unqualified-inputs.json')),
      ),
    ).toEqual(artifactIdentity);
    expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe('mismatch');
  } })),
  ...(['exit-before-output', 'exit-after-output'] as const).map(mode => it({ name: `records child observation after bootstrap ${mode}`, fn: async () => {
    await using f = await fixture(mode);
    const error = await rejected(f.request());
    expect(error.kind).toBe('bootstrap');
    if (error.directory === undefined) throw new Error('Expected retained failure directory');
    const observation = await readRecord(join(error.directory, 'child-observation.json'));
    expect(observation.state).toBe(mode === 'exit-before-output' ? 'absent' : 'single');
    if (mode === 'exit-after-output') {
      const [child] = await readdir(join(error.directory, 'producer-runs'));
      if (child === undefined) throw new Error('Expected retained input run');
      expect(
        identity(
          await readFile(join(error.directory, 'producer-runs', child, 'output/unqualified-inputs.json')),
        ),
      ).toEqual(artifactIdentity);
    }
    expect((await readdir(error.directory)).includes('comparison.json')).toBe(false);
  } })),
  ...(['malformed-stdout', 'wrong-stdout-directory', 'extra-stdout-key', 'extra-child', 'no-child', 'child-file', 'bad-run-id', 'extra-output', 'home-content', 'artifact-mode', 'artifact-hash', 'wrong-completion-run', 'wrong-completion-launch', 'extra-completion-key', 'wrong-created-launch', 'wrong-created-owner', 'wrong-verified-completion', 'cleanup-interrupted', 'stderr-on-success', 'stdout-mode', 'stderr-mode', 'stdout-replacement', 'stderr-replacement', 'wrong-created-group', 'input-directory-mode', 'output-directory-mode', 'home-directory-mode', 'output-directory-symlink', 'artifact-symlink'] as const).map(mode => it({ name: `refuses retained output boundary ${mode}`, fn: async () => {
    await using f = await fixture(mode);
    const error = await rejected(f.request());
    expect(error.kind).toBe('output');
    expect(error.message).not.toContain('q7z9k2');
    if (error.directory === undefined) throw new Error('Expected retained comparison directory');
    expect((await readdir(error.directory)).includes('failure.json')).toBe(true);
    expect((await readdir(error.directory)).includes('comparison.json')).toBe(false);
    if (mode === 'extra-child') {
      const observation = await readRecord(join(error.directory, 'child-observation.json'));
      expect(observation.state).toBe('ambiguous');
      expect(observation.children).toHaveLength(2);
      expect(observation.completeEnumeration).toBe(false);
    }
  } })),
  ...(['relative-base', 'wrong-bootstrap-name', 'zero-extent', 'unsafe-extent', 'uppercase-digest', 'null-reference', 'invalid-signal', 'public-output-parent', 'non-string-path', 'nul-path', 'unnormalized-path', 'non-string-digest', 'short-digest', 'fractional-extent', 'non-number-extent'] as const).map(change => it({ name: `refuses comparison contract ${change} before namespace creation`, fn: async () => {
    await using f = await fixture();
    const request = f.request();
    if (change === 'relative-base') Reflect.set(request, 'baseLaunchPath', 'base-launch.json');
    else if (change === 'wrong-bootstrap-name') Reflect.set(request, 'bootstrapPath', join(f.directory, 'other.mjs'));
    else if (change === 'zero-extent') Reflect.set(request, 'reference', { ...artifactIdentity, bytes: 0 });
    else if (change === 'unsafe-extent') Reflect.set(request, 'reference', { ...artifactIdentity, bytes: Number.MAX_SAFE_INTEGER + 1 });
    else if (change === 'uppercase-digest') Reflect.set(request, 'reference', { ...artifactIdentity, sha256: 'A'.repeat(64) });
    else if (change === 'null-reference') Reflect.set(request, 'reference', null);
    else if (change === 'invalid-signal') Reflect.set(request, 'signal', {});
    else if (change === 'non-string-path') Reflect.set(request, 'baseLaunchPath', 1);
    else if (change === 'nul-path') Reflect.set(request, 'baseLaunchPath', `${f.baseLaunchPath}\0`);
    else if (change === 'unnormalized-path') Reflect.set(request, 'baseLaunchPath', `${f.directory}/./base-launch.json`);
    else if (change === 'non-string-digest') Reflect.set(request, 'reference', { ...artifactIdentity, sha256: 1 });
    else if (change === 'short-digest') Reflect.set(request, 'reference', { ...artifactIdentity, sha256: '0' });
    else if (change === 'fractional-extent') Reflect.set(request, 'reference', { ...artifactIdentity, bytes: 1 / 2 });
    else if (change === 'non-number-extent') Reflect.set(request, 'reference', { ...artifactIdentity, bytes: '1' });
    else await chmod(f.output, 0o755);
    const error = await rejected(request);
    expect(error.kind).toBe('contract');
    expect(await readdir(f.output)).toEqual([]);
  } })),
  it({ name: 'refuses equal-extent base-launch byte drift before creating a namespace', fn: async () => {
    await using f = await fixture();
    const request = f.request();
    const changed = Buffer.from(f.baseBytes);
    changed[0] = CORRUPT_OPENING_BYTE;
    await writeFile(f.baseLaunchPath, changed);
    const error = await rejected(request);
    expect(error.kind).toBe('contract');
    expect(error.directory).toBeUndefined();
    expect(await readdir(f.output)).toEqual([]);
  } }),
  it({ name: 'refuses an already aborted request without creating a comparison namespace', fn: async () => {
    await using f = await fixture();
    const controller = new AbortController();
    controller.abort(new Error('private cancellation q7z9k2'));
    const error = await rejected({ ...f.request(), signal: controller.signal });
    expect(error.kind).toBe('interruption');
    expect(error.message).not.toContain('q7z9k2');
    expect(await readdir(f.output)).toEqual([]);
  } }),
  it({ name: 'keeps concurrent failed invocations associated with separate dedicated native parents', fn: async () => {
    await using f = await fixture('exit-after-output');
    const failures = await Promise.all([rejected(f.request()), rejected(f.request())]);
    expect(failures[0]?.directory).not.toBe(failures[1]?.directory);
    await Promise.all(failures.map(async function verifyFailure(failure): Promise<void> {
      expect(failure.kind).toBe('bootstrap');
      if (failure.directory === undefined) throw new Error('Expected independently retained namespace');
      const observation = await readRecord(join(failure.directory, 'child-observation.json'));
      expect(observation.state).toBe('single');
      expect(observation.children).toHaveLength(1);
      expect(
        await readdir(join(failure.directory, 'producer-runs')),
      ).toHaveLength(1);
    }));
  } }),
  it({ name: 'owns reference primitives before logger callbacks mutate caller data', fn: async () => {
    await using f = await fixture();
    const reference = { ...artifactIdentity };
    const result = await accepted({ ...f.request(), reference, l: {
      ...l,
      debug(message) {
        reference.sha256 = '0'.repeat(64);
        l.debug(message);
      },
    } });
    expect(reference.sha256).toBe('0'.repeat(64));
    expect(result.artifact.sha256).toBe(artifactIdentity.sha256);
  } }),
  it({ name: 'owns launch locators and identity before callback mutation of the request', fn: async () => {
    await using f = await fixture();
    const request = f.request();
    const expected = { ...request.baseLaunchIdentity };
    Reflect.set(request, 'l', { ...l, debug(message: string) {
      Reflect.set(request.baseLaunchIdentity, 'bytes', 0);
      Reflect.set(request.baseLaunchIdentity, 'sha256', '0'.repeat(64));
      Reflect.set(request, 'baseLaunchPath', '/unowned-q7z9k2/base.json');
      Reflect.set(request, 'bootstrapPath', '/unowned-q7z9k2/producer-prepare.mjs');
      l.debug(message);
    } });
    const result = await accepted(request);
    expect(result.baseLaunchIdentity).toEqual(expected);
    expect(request.baseLaunchIdentity.bytes).toBe(0);
    expect(request.baseLaunchPath).toBe('/unowned-q7z9k2/base.json');
    expect(result.artifact.sha256).toBe(artifactIdentity.sha256);
  } }),
  it({ name: 'rechecks the dedicated parent after a single-child association is recorded', fn: async ctx => {
    await using f = await fixture();
    const changed = ctx.sinon.spy(function addLateChild() {});
    const logger = { ...l, info(message: string) {
      if (message.includes('retained native child observation single')) {
        const entries = readdirSync(f.output);
        const [name] = entries;
        if ((entries.length !== 1) || (name === undefined)) throw new Error('Expected one owned comparison directory');
        mkdirSync(join(f.output, name, 'producer-runs', 'unexpected-late-child'), { mode: 0o700 });
        changed();
      }
      l.info(message);
    } };
    const error = await rejected({ ...f.request(), l: logger });
    expect(changed.callCount).toBe(1);
    expect(error.kind).toBe('output');
    if (error.directory === undefined) throw new Error('Expected retained late-child refusal');
    expect((await readRecord(join(error.directory, 'child-observation.json'))).state).toBe('single');
    expect((await readdir(error.directory)).includes('comparison.json')).toBe(false);
  } }),
  it({ name: 'refuses a revoked error proxy thrown by a caller getter without leaking it or creating output', fn: async () => {
    await using f = await fixture();
    const revoked = Proxy.revocable(new Error('private proxied q7z9k2'), {});
    revoked.revoke();
    expect(Error.isError(revoked.proxy)).toBe(false);
    expect(() => Reflect.getPrototypeOf(revoked.proxy)).toThrow(TypeError);
    const request = f.request();
    Object.defineProperty(request, 'reference', {
      get() {
        throw revoked.proxy;
      },
    });
    const error = await rejected(request);
    expect(error.kind).toBe('contract');
    expect(await readdir(f.output)).toEqual([]);
  } }),
  ...([false, true, 'always'] as const).map(throwAfterClose => it({ name: `retains cancelled complete output with awaiting-owner logger failure=${throwAfterClose}`, timeout: 30_000, fn: async ctx => {
    await using f = await fixture('wait-after-output');
    const controller = new AbortController();
    const ready = ctx.sinon.spy(function readyForCancellation() {
      controller.abort(new Error('private abort q7z9k2'));
    });
    const escaped = ctx.sinon.spy(function escapedCallback() {});
    const logged = new Set<string>();
    process.on('uncaughtException', escaped);
    const watcher = watch(f.output, { recursive: true }, function observed(_event, filename) {
      if (((typeof filename) === 'string') && filename.endsWith('ready.txt')) ready();
    });
    watcher.on('error', function watchFailed(error) {
      controller.abort(error);
    });
    using cleanup = {
      [Symbol.dispose]() {
        watcher.close();
        process.off('uncaughtException', escaped);
      },
    };
    const error = await rejected({ ...f.request(), signal: controller.signal, l: { ...l, warn(message) {
      if ((throwAfterClose === 'always') || (throwAfterClose && message.includes('bootstrap interruption observed after native close') && (logged.size === 0))) {
        logged.add(message);
        throw new Error('awaiting logging q7z9k2');
      }
      l.warn(message);
    } } });
    if (throwAfterClose === 'always') expect(logged.size).toBeGreaterThan(0);
    else expect(logged.size).toBe(throwAfterClose ? 1 : 0);
    expect(ready.callCount).toBeGreaterThan(0);
    expect(escaped.callCount).toBe(0);
    expect(error.kind).toBe('interruption');
    expect(error.loggerCallbackFailures).toEqual(throwAfterClose !== false ? ['warn'] : []);
    expect(error.message).not.toContain('q7z9k2');
    if (error.directory === undefined) throw new Error('Expected retained cancelled namespace');
    const [child] = await readdir(join(error.directory, 'producer-runs'));
    if (child === undefined) throw new Error('Expected completed fixture output');
    expect(
      identity(
        await readFile(join(error.directory, 'producer-runs', child, 'output/unqualified-inputs.json')),
      ),
    ).toEqual(artifactIdentity);
    expect((await readRecord(join(error.directory, 'child-observation.json'))).state).toBe('single');
    expect((await readdir(error.directory)).includes('comparison.json')).toBe(false);
    const exit = await readRecord(join(error.directory, 'bootstrap.exit.json'));
    expect(exit.callerAborted).toBe(true);
    expect(exit.signal).toBe('SIGTERM');
    expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe('interruption');
  } })),
  it({ name: 'retains a matching comparison when cancellation arrives after persistence', fn: async ctx => {
    await using f = await fixture();
    const controller = new AbortController();
    const interrupted = ctx.sinon.spy(function cancelAfterComparison() {
      controller.abort(new Error('late private q7z9k2'));
    });
    const error = await rejected({ ...f.request(), signal: controller.signal, l: { ...l, info(message) {
      if (message.includes('matched retained unqualified input bytes')) interrupted();
      l.info(message);
    } } });
    expect(interrupted.callCount).toBe(1);
    expect(error.kind).toBe('interruption');
    if (error.directory === undefined) throw new Error('Expected retained late-interruption evidence');
    expect((await readRecord(join(error.directory, 'comparison.json'))).matches).toBe(true);
    expect((await readRecord(join(error.directory, 'bootstrap.exit.json'))).code).toBe(0);
    expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe('interruption');
  } }),
  it({ name: 'retains native spawn errors but waits for actual close before exit metadata', fn: async ctx => {
    await using f = await fixture();
    const nativeSpawn = childProcess.spawn;
    const beforeClose = ctx.sinon.spy(function observedBeforeClose(_persisted: boolean) {});
    const forcedSpawn = ctx.sinon.spy(function forcedMissingExecutable() {});
    ctx.sinon.stub(childProcess, 'spawn').callsFake(function missingBootstrap(executable, args, options) {
      if ((executable !== process.execPath) || (args[0] !== f.bootstrapPath)) return nativeSpawn(executable, args, options);
      forcedSpawn();
      const child = nativeSpawn(join(f.directory, 'missing-node'), args, options);
      const nativeEmit = child.emit.bind(child);
      const directory = options?.cwd;
      if ((typeof directory) !== 'string') throw new Error('Expected comparison cwd');
      const exitPath = join(directory, 'bootstrap.exit.json');
      ctx.sinon.stub(child, 'emit').callsFake(function delayedClose(event, first, second) {
        if (arguments.length > 3) throw new Error('Unexpected native event interception arity');
        if (event === 'close') {
          setTimeout(function closeLater() {
            beforeClose(existsSync(exitPath));
            nativeEmit(event, first, second);
          }, 50);
          return true;
        }
        return nativeEmit(event, first, second);
      });
      return child;
    });
    syncBuiltinESMExports();
    using restore = {
      [Symbol.dispose]() {
        ctx.sinon.restore();
        syncBuiltinESMExports();
      },
    };
    const error = await rejected(f.request());
    expect(forcedSpawn.callCount).toBe(1);
    expect(beforeClose.callCount).toBe(1);
    expect(beforeClose.firstCall.args[0]).toBe(false);
    expect(error.kind).toBe('bootstrap');
    if (error.directory === undefined) throw new Error('Expected retained native spawn failure');
    expect(await readdir(error.directory)).toContain('bootstrap.exit.json');
    const exit = await readRecord(join(error.directory, 'bootstrap.exit.json'));
    expect(exit.errors).toEqual(['error-object']);
    expect((await readRecord(join(error.directory, 'child-observation.json'))).state).toBe('absent');
  } }),
  it({ name: 'refuses interruption observation setup before creating a native child', timeout: 30_000, fn: async ctx => {
    await using f = await fixture();
    const nativeSpawn = childProcess.spawn;
    const nativeEventMethods = Object.getOwnPropertyDescriptors(EventTarget.prototype);
    const state: { child?: ReturnType<typeof childProcess.spawn> } = {};
    const closed = Promise.withResolvers<void>();
    const attempts = ctx.sinon.spy(function observeSetupFailure() {});
    const spawned = ctx.sinon.spy(function observeNativeChild() {});
    ctx.sinon.stub(childProcess, 'spawn').callsFake(function trackBootstrap(executable, args, options) {
      const child = nativeSpawn(executable, args, options);
      if ((executable === process.execPath) && (args[0] === f.bootstrapPath)) {
        state.child = child;
        spawned();
        child.once('close', function observeClose() {
          closed.resolve();
        });
      }
      return child;
    });
    ctx.sinon.stub(EventTarget.prototype, 'addEventListener').callsFake(function refuseSetup(this: EventTarget, type, listener, options) {
      if ((type === 'abort') && (this instanceof AbortSignal)) {
        attempts();
        throw new Error('native interruption registration fixture q7z9k2');
      }
      if (nativeEventMethods.addEventListener.value === undefined) throw new Error('Expected native event method');
      nativeEventMethods.addEventListener.value.call(this, type, listener, options);
    });
    syncBuiltinESMExports();
    await using restore = { async [Symbol.asyncDispose]() {
      const { child } = state;
      if (child !== undefined) {
        if ((child.exitCode === null) && (child.signalCode === null)) child.kill('SIGTERM');
        await closed.promise;
      }
      ctx.sinon.restore();
      syncBuiltinESMExports();
    } };
    const error = await rejected(f.request());
    expect(attempts.callCount).toBe(1);
    expect(spawned.callCount).toBe(0);
    expect(error.kind).toBe('bootstrap');
    expect(error.message).not.toContain('q7z9k2');
    if (error.directory === undefined) throw new Error('Expected retained setup refusal');
    expect((await readRecord(join(error.directory, 'child-observation.json'))).state).toBe('absent');
  } }),
  it({ name: 'forwards cancellation received inside spawn after installing native close observation', fn: async ctx => {
    await using f = await fixture('wait-after-output');
    const controller = new AbortController();
    const nativeSpawn = childProcess.spawn;
    const spawned = ctx.sinon.spy(function observeSpawn() {});
    const closed = ctx.sinon.spy(function observeNativeClose() {});
    ctx.sinon.stub(childProcess, 'spawn').callsFake(function abortBeforeAttach(executable, args, options) {
      const child = nativeSpawn(executable, args, options);
      if ((executable === process.execPath) && (args[0] === f.bootstrapPath)) {
        spawned();
        child.once('close', closed);
        controller.abort(new Error('early attachment cancellation q7z9k2'));
      }
      return child;
    });
    syncBuiltinESMExports();
    using restore = { [Symbol.dispose]() {
      ctx.sinon.restore();
      syncBuiltinESMExports();
    } };
    const error = await rejected({ ...f.request(), signal: controller.signal });
    expect(spawned.callCount).toBe(1);
    expect(closed.callCount).toBe(1);
    expect(error.kind).toBe('interruption');
    if (error.directory === undefined) throw new Error('Expected retained early cancellation directory');
    const exit = await readRecord(join(error.directory, 'bootstrap.exit.json'));
    expect(exit.callerAborted).toBe(true);
    expect(exit.signal).toBe('SIGTERM');
    expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe('interruption');
  } }),
  it({ name: 'observes actual close after deadline escalation without changing production timeout parameters', timeout: 30_000, fn: async ctx => {
    await using f = await fixture('ignore-term-after-output');
    const deadline = new AbortController();
    const actualTimeout = AbortSignal.timeout.bind(AbortSignal);
    const actualTimer = timers.setTimeout;
    const shortened = ctx.sinon.spy(function shortenedGrace() {});
    const ready = ctx.sinon.spy(function triggerDeadline() {
      deadline.abort(new Error('fixture deadline'));
    });
    ctx.sinon.stub(AbortSignal, 'timeout').callsFake(function fixtureDeadline(milliseconds) {
      return milliseconds === 600_000 ? deadline.signal : actualTimeout(milliseconds);
    });
    ctx.sinon.stub(timers, 'setTimeout').callsFake(function fixtureGrace(callback, milliseconds) {
      if (arguments.length > 2) throw new Error('Unexpected timer interception arity');
      if (milliseconds === 180_000) {
        shortened();
        return actualTimer(callback, 30);
      }
      return actualTimer(callback, milliseconds);
    });
    syncBuiltinESMExports();
    const watcher = watch(f.output, { recursive: true }, function observed(_event, filename) {
      if (((typeof filename) === 'string') && filename.endsWith('ready.txt')) ready();
    });
    watcher.on('error', function watchFailed(error) {
      deadline.abort(error);
    });
    using restore = {
      [Symbol.dispose]() {
        watcher.close();
        ctx.sinon.restore();
        syncBuiltinESMExports();
      },
    };
    const error = await rejected(f.request());
    expect(ready.callCount).toBeGreaterThan(0);
    expect(shortened.callCount).toBe(1);
    expect(error.kind).toBe('interruption');
    if (error.directory === undefined) throw new Error('Expected retained deadline evidence');
    const exit = await readRecord(join(error.directory, 'bootstrap.exit.json'));
    expect(exit.signal).toBe('SIGKILL');
    expect(exit.code).toBeNull();
    expect(exit.deadlineReached).toBe(true);
    expect(exit.callerAborted).toBe(false);
    expect((await readRecord(join(error.directory, 'child-observation.json'))).state).toBe('single');
    expect((await readdir(error.directory)).includes('comparison.json')).toBe(false);
    const [child] = await readdir(join(error.directory, 'producer-runs'));
    if (child === undefined) throw new Error('Expected retained completed fixture output');
    expect(
      identity(
        await readFile(join(error.directory, 'producer-runs', child, 'output/unqualified-inputs.json')),
      ),
    ).toEqual(artifactIdentity);
  } }),
  ...(['comparison-collision', 'failure-collision'] as const).map(mode => it({ name: `preserves existing metadata on ${mode}`, fn: async () => {
    await using f = await fixture(mode);
    const error = await rejected(f.request());
    expect(error.kind).toBe('storage');
    if (error.directory === undefined) throw new Error('Expected retained collision namespace');
    const file = mode === 'comparison-collision' ? 'comparison.json' : 'failure.json';
    const original = mode === 'comparison-collision' ? 'existing comparison q7z9k2' : 'existing failure q7z9k2';
    expect(await readFile(join(error.directory, file), 'utf8')).toBe(original);
    const [child] = await readdir(join(error.directory, 'producer-runs'));
    if (child === undefined) throw new Error('Expected retained complete output');
    expect(
      identity(
        await readFile(join(error.directory, 'producer-runs', child, 'output/unqualified-inputs.json')),
      ),
    ).toEqual(artifactIdentity);
  } })),
  ...(['pathname', 'content'] as const).map(change => it({ name: `refuses metadata ${change} replacement after the created descriptor syncs`, fn: async ctx => {
    await using f = await fixture();
    const nativeOpen = fsPromises.open;
    const replaced = ctx.sinon.spy(function replacedPath() {});
    ctx.sinon.stub(fsPromises, 'open').callsFake(async function observedOpen(path, flags, mode) {
      const handle = await nativeOpen(path, flags, mode);
      if (((typeof path) === 'string') && path.endsWith('/comparison.json')) {
        const targetPath: string = path;
        const nativeSync = handle.sync.bind(handle);
        ctx.sinon.stub(handle, 'sync').callsFake(async function replaceAfterSync() {
          await nativeSync();
          const bytes = await readFile(targetPath);
          if (change === 'pathname') {
            await rename(targetPath, `${targetPath}.opened`);
            await writeFile(targetPath, bytes, { mode: 0o600, flag: 'wx' });
          } else {
            const changed = Buffer.from(bytes);
            changed[0] = CORRUPT_OPENING_BYTE;
            await writeFile(targetPath, changed);
          }
          replaced();
        });
      }
      return handle;
    });
    syncBuiltinESMExports();
    using restore = {
      [Symbol.dispose]() {
        ctx.sinon.restore();
        syncBuiltinESMExports();
      },
    };
    const error = await rejected(f.request());
    expect(replaced.callCount).toBe(1);
    expect(error.kind).toBe('storage');
    if (error.directory === undefined) throw new Error('Expected retained replaced metadata');
    if (change === 'pathname') {
      const current = await readFile(join(error.directory, 'comparison.json'));
      const opened = await readFile(join(error.directory, 'comparison.json.opened'));
      expect(current).toEqual(opened);
    } else expect((await readFile(join(error.directory, 'comparison.json')))[0]).toBe(CORRUPT_OPENING_BYTE);
  } })),
  ...(['binary', 'version', 'component'] as const).map(change => it({ name: `refuses a self-consistent launch with wrong Node ${change} before executing the correct bootstrap`, fn: async () => {
    await using f = await fixture();
    const manifestPath = join(f.runtime, 'sealed-runtime.json');
    const manifest = await readRecord(manifestPath);
    const node = recordValue(manifest.node);
    const alteredNode = change === 'binary' ? { ...node, executable: { bytes: nodeIdentity.bytes, sha256: '0'.repeat(64) } }
      : change === 'version' ? { ...node, version: 'v0.0.0' }
      : { ...node, versions: { ...recordValue(node.versions), v8: 'fixture-different-component' } };
    const wrong = { ...manifest, node: alteredNode };
    const manifestBytes = Buffer.from(JSON.stringify(wrong));
    await writeFile(manifestPath, manifestBytes);
    const base = { ...f.base, runtime: { dir: f.runtime, manifest: identity(manifestBytes) } };
    const baseBytes = Buffer.from(JSON.stringify(base));
    await writeFile(f.baseLaunchPath, baseBytes);
    const error = await rejected({ ...f.request(), baseLaunchIdentity: identity(baseBytes) });
    expect(error.kind).toBe('bootstrap');
    if (error.directory === undefined) throw new Error('Expected retained authentication refusal');
    expect((await readdir(error.directory)).includes('bootstrap.command.json')).toBe(true);
    expect((await readdir(error.directory)).includes('invoked.json')).toBe(false);
    expect((await readRecord(join(error.directory, 'child-observation.json'))).state).toBe('absent');
  } })),
  it({ name: 'passes only the exact minimal environment and omits an ambient canary', fn: async () => {
    await using f = await fixture();
    const prior = process.env.PREPARATION_COMPARISON_CANARY;
    process.env.PREPARATION_COMPARISON_CANARY = 'q7z9k2';
    using restore = { [Symbol.dispose]() {
      if (prior === undefined) Reflect.deleteProperty(process.env, 'PREPARATION_COMPARISON_CANARY');
      else process.env.PREPARATION_COMPARISON_CANARY = prior;
    } };
    const result = await accepted(f.request());
    const invoked = await readRecord(join(result.directory, 'invoked.json'));
    const expectedKeys = ['HOME', 'PATH', ...['XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS'].filter(key => process.env[key] !== undefined)];
    expect(textList(invoked.environmentKeys).toSorted()).toEqual(expectedKeys.toSorted());
    expect(invoked.environmentKeys).not.toContain('PREPARATION_COMPARISON_CANARY');
  } }),
  //region Native cancellation state is owned without borrowing caller accessors or reasons
  it({ name: 'does not borrow an own aborted getter to decide comparison state or error metadata', fn: async ctx => {
    await using f = await fixture();
    const controller = new AbortController();
    const getter = ctx.sinon.stub().throws(new ProducerInputComparisonError({ kind: 'storage', directory: '/foreign-signal-q7z9k2', loggerCallbackFailures: ['fatal'] }));
    Object.defineProperty(controller.signal, 'aborted', { get: getter });
    const result = await accepted({ ...f.request(), signal: controller.signal });
    expect(getter.callCount).toBe(0);
    expect(result.artifact.sha256).toBe(artifactIdentity.sha256);
    expect(result.loggerCallbackFailures).toEqual([]);
  } }),
  it({ name: 'registers native cancellation without invoking a caller registration getter', fn: async ctx => {
    await using f = await fixture();
    const controller = new AbortController();
    const getter = ctx.sinon.stub().throws(new Error('private registration getter q7z9k2'));
    Object.defineProperty(controller.signal, 'addEventListener', { get: getter });
    const result = await accepted({ ...f.request(), signal: controller.signal });
    expect(getter.callCount).toBe(0);
    expect(result.artifact.sha256).toBe(artifactIdentity.sha256);
  } }),
  it({ name: 'keeps native cancellation live after late own signal accessors are replaced', fn: async ctx => {
    await using f = await fixture();
    const controller = new AbortController();
    const getter = ctx.sinon.stub().throws(new ProducerInputComparisonError({ kind: 'storage', directory: '/late-signal-q7z9k2' }));
    const installed = new Set<string>();
    const error = await rejected({ ...f.request(), signal: controller.signal, l: { ...l, debug(message) {
      if (installed.size === 0) {
        for (const key of ['aborted', 'reason', 'addEventListener', 'removeEventListener']) {
          Object.defineProperty(controller.signal, key, { get: getter, configurable: true });
          installed.add(key);
        }
      }
      l.debug(message);
    }, info(message) {
      if (message.includes('matched retained unqualified input bytes')) controller.abort(new Error('private cancellation reason q7z9k2'));
      l.info(message);
    } } });
    expect(installed.size).toBe(4);
    expect(getter.callCount).toBe(0);
    expect(error.kind).toBe('interruption');
    expect(error.message).not.toContain('q7z9k2');
    if (error.directory === undefined) throw new Error('Expected owned cancellation directory');
    expect((await readRecord(join(error.directory, 'comparison.json'))).matches).toBe(true);
    expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe('interruption');
  } }),
  it({ name: 'does not let a synthetic abort consume subsequent native cancellation', fn: async () => {
    await using f = await fixture();
    const controller = new AbortController();
    const sent = new Set<string>();
    const error = await rejected({ ...f.request(), signal: controller.signal, l: { ...l, debug(message) {
      if (sent.size === 0) {
        controller.signal.dispatchEvent(new Event('abort'));
        sent.add('synthetic');
      }
      l.debug(message);
    }, info(message) {
      if (message.includes('matched retained unqualified input bytes')) controller.abort();
      l.info(message);
    } } });
    expect(sent.size).toBe(1);
    expect(error.kind).toBe('interruption');
    if (error.directory === undefined) throw new Error('Expected retained final cancellation');
    expect((await readRecord(join(error.directory, 'comparison.json'))).matches).toBe(true);
  } }),
  it({ name: 'preserves native cancellation despite an earlier propagation-stopping listener', fn: async ctx => {
    await using f = await fixture();
    const controller = new AbortController();
    const stopped = ctx.sinon.spy(function stopEvent(event: Event) {
      event.stopImmediatePropagation();
    });
    controller.signal.addEventListener('abort', stopped);
    const error = await rejected({ ...f.request(), signal: controller.signal, l: { ...l, info(message) {
      if (message.includes('matched retained unqualified input bytes')) controller.abort();
      l.info(message);
    } } });
    expect(stopped.callCount).toBe(1);
    expect(error.kind).toBe('interruption');
    if (error.directory === undefined) throw new Error('Expected retained cancellation directory');
    expect((await readRecord(join(error.directory, 'comparison.json'))).matches).toBe(true);
  } }),
  it({ name: 'does not treat a redispatched trusted event as native cancellation', fn: async () => {
    await using f = await fixture();
    const original = new AbortController();
    const captured: { event?: Event } = {};
    original.signal.addEventListener('abort', function capture(event: Event) {
      captured.event = event;
    });
    original.abort();
    const { event } = captured;
    if (event === undefined) throw new Error('Expected native event capture');
    const nativeEvent: Event = event;
    expect(nativeEvent.isTrusted).toBe(true);
    const controller = new AbortController();
    const dispatched = new Set<string>();
    const result = await accepted({ ...f.request(), signal: controller.signal, l: { ...l, debug(message) {
      if (dispatched.size === 0) {
        controller.signal.dispatchEvent(nativeEvent);
        dispatched.add('replayed');
      }
      l.debug(message);
    } } });
    expect(dispatched.size).toBe(1);
    expect(controller.signal.aborted).toBe(false);
    expect(result.artifact.sha256).toBe(artifactIdentity.sha256);
  } }),
  it({ name: 'removes its native signal subscription without invoking a caller removal getter', fn: async ctx => {
    await using f = await fixture();
    const controller = new AbortController();
    const before = getEventListeners(controller.signal, 'abort');
    const getter = ctx.sinon.stub().throws(new Error('private removal getter q7z9k2'));
    const descriptor = { get: getter, configurable: true };
    Object.defineProperty(controller.signal, 'removeEventListener', descriptor);
    const result = await accepted({ ...f.request(), signal: controller.signal });
    expect(getter.callCount).toBe(0);
    expect(getEventListeners(controller.signal, 'abort')).toEqual(before);
    expect(Object.getOwnPropertyDescriptor(controller.signal, 'removeEventListener')).toMatchObject(descriptor);
    expect(Object.isExtensible(controller.signal)).toBe(true);
    expect(result.artifact.sha256).toBe(artifactIdentity.sha256);
  } }),
  ...(['proxy', 'revoked', 'forged'] as const).map(shape => it({ name: `refuses ${shape} signal state before creating a namespace`, fn: async () => {
    await using f = await fixture();
    const controller = new AbortController();
    const proxy = Proxy.revocable(controller.signal, {});
    if (shape === 'revoked') proxy.revoke();
    const request = f.request();
    Reflect.set(request, 'signal', shape === 'forged' ? Object.create(AbortSignal.prototype) : proxy.proxy);
    const error = await rejected(request);
    expect(error.kind).toBe('contract');
    expect(error.directory).toBeUndefined();
    expect(await readdir(f.output)).toEqual([]);
  } })),
  ...(['setup', 'after-close'] as const).map(phase => it({ name: `refuses unreadable composite source state at ${phase} without borrowing error metadata`, fn: async ctx => {
    await using f = await fixture();
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal]);
    const poisoned = ctx.sinon.spy(function poisonSource() {
      Object.defineProperty(controller.signal, 'aborted', { get() {
        throw new ProducerInputComparisonError({ kind: 'storage', directory: '/composite-source-q7z9k2' });
      } });
    });
    if (phase === 'setup') poisoned();
    const error = await rejected({ ...f.request(), signal, l: { ...l, info(message) {
      if ((phase === 'after-close') && message.includes('input bootstrap closed successfully')) {
        poisoned();
        signal.dispatchEvent(new Event('abort'));
      }
      l.info(message);
    } } });
    expect(poisoned.callCount).toBe(1);
    expect(error.kind).toBe('contract');
    expect(error.message).not.toContain('q7z9k2');
    if (phase === 'setup') {
      expect(error.directory).toBeUndefined();
      expect(await readdir(f.output)).toEqual([]);
    } else {
      if (error.directory === undefined) throw new Error('Expected owned composite refusal directory');
      expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe('contract');
      const exit = await readRecord(join(error.directory, 'bootstrap.exit.json'));
      expect(exit.callerAborted).toBe(false);
      expect(exit.code).toBe(0);
    }
  } })),
  it({ name: 'preserves actual cancellation after an unreadable synthetic composite observation', fn: async () => {
    await using f = await fixture();
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal]);
    const changed = new Set<string>();
    const error = await rejected({ ...f.request(), signal, l: { ...l, debug(message) {
      if (changed.size === 0) {
        Object.defineProperty(controller.signal, 'aborted', { get() {
          throw new ProducerInputComparisonError({ kind: 'storage', directory: '/precedence-q7z9k2' });
        } });
        changed.add('synthetic');
        signal.dispatchEvent(new Event('abort'));
        controller.abort(new Error('actual cancellation q7z9k2'));
      }
      l.debug(message);
    } } });
    expect(changed.size).toBe(1);
    expect(error.kind).toBe('interruption');
    expect(error.directory).toBeUndefined();
    expect(error.message).not.toContain('q7z9k2');
    expect(await readdir(f.output)).toEqual([]);
  } }),
  ...(['success', 'mismatch', 'cancel'] as const).map(outcome => it({ name: `observes subscription cleanup failure before reporting ${outcome} without replacing primary metadata`, fn: async ctx => {
    await using f = await fixture();
    const nativeAdd = events.addAbortListener;
    const failedCleanup = ctx.sinon.spy(function recordCleanupFailure() {});
    const warnings: string[] = [];
    const controller = new AbortController();
    ctx.sinon.stub(events, 'addAbortListener').callsFake(function observedSubscription(signal, listener) {
      const subscription = nativeAdd(signal, listener);
      return { [Symbol.dispose]() {
        subscription[Symbol.dispose]();
        failedCleanup();
        throw new Error('private cleanup failure q7z9k2');
      } };
    });
    syncBuiltinESMExports();
    using restore = { [Symbol.dispose]() {
      ctx.sinon.restore();
      syncBuiltinESMExports();
    } };
    const error = await rejected({ ...f.request(), signal: controller.signal, reference: outcome === 'mismatch' ? { ...artifactIdentity, sha256: '0'.repeat(64) } : artifactIdentity, l: { ...l, warn(message) {
      warnings.push(message);
    }, info(message) {
      if ((outcome === 'cancel') && message.includes('matched retained unqualified input bytes')) controller.abort();
      l.info(message);
    } } });
    const expected = outcome === 'success' ? 'contract' : outcome === 'mismatch' ? 'mismatch' : 'interruption';
    expect(failedCleanup.callCount).toBe(1);
    expect(error.kind).toBe(expected);
    expect(warnings.some(message => message.includes('cancellation observation failed; primary comparison failure remains retained'))).toBe(true);
    expect(error.message).not.toContain('q7z9k2');
    if (error.directory === undefined) throw new Error('Expected retained cleanup observation');
    expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe(expected);
    expect(error.message).toBe(new ProducerInputComparisonError({ kind: expected, directory: error.directory }).message);
  } })),
  it({ name: 'restores ordinary propagation suppression after the owned subscription is removed', fn: async ctx => {
    await using f = await fixture();
    const controller = new AbortController();
    const stopped = ctx.sinon.spy(function stopEvent(event: Event) {
      event.stopImmediatePropagation();
    });
    const ordinary = ctx.sinon.spy(function ordinaryListener() {});
    controller.signal.addEventListener('abort', stopped);
    controller.signal.addEventListener('abort', ordinary);
    controller.signal.dispatchEvent(new Event('abort'));
    expect(stopped.callCount).toBe(1);
    expect(ordinary.callCount).toBe(0);
    await accepted({ ...f.request(), signal: controller.signal });
    expect(getEventListeners(controller.signal, 'abort')).toEqual([stopped, ordinary]);
    controller.abort();
    expect(stopped.callCount).toBe(2);
    expect(ordinary.callCount).toBe(0);
  } }),
  //endregion Native cancellation state is owned without borrowing caller accessors or reasons
  //region Persistent caller logging failures cannot replace storage or operation evidence
  ...(['normal', 'exit-after-output', 'extra-output'] as const).flatMap(mode => [false, true].map(revoked => it({ name: `retains primary ${mode} failure and its record when every warning throws revoked=${revoked}`, fn: async ctx => {
    await using f = await fixture(mode);
    const proxy = Proxy.revocable(new Error('private logger q7z9k2'), {});
    proxy.revoke();
    const fault = revoked ? proxy.proxy : new Error('private logger q7z9k2');
    const warning = ctx.sinon.spy(function persistentWarningFailure(_message: string): void {
      throw fault;
    });
    const expectedKind = mode === 'normal' ? 'mismatch' : mode === 'exit-after-output' ? 'bootstrap' : 'output';
    const [result] = await Promise.allSettled([runProducerInputComparison({
      ...f.request(),
      reference: { ...artifactIdentity, sha256: '0'.repeat(64) },
      l: { ...l, warn: warning },
    })]);
    expect(result?.status).toBe('rejected');
    const [comparisonName] = await readdir(f.output);
    if (comparisonName === undefined) throw new Error('Expected retained comparison namespace');
    const directory = join(f.output, comparisonName);
    const [child] = await readdir(join(directory, 'producer-runs'));
    if (child === undefined) throw new Error('Expected retained useful output');
    const artifact = await readFile(join(directory, 'producer-runs', child, 'output/unqualified-inputs.json'));
    expect(identity(artifact)).toEqual(artifactIdentity);
    expect(
      existsSync(join(directory, 'failure.json')),
    ).toBe(true);
    const failureRecord = await readRecord(join(directory, 'failure.json'));
    expect(failureRecord.failure).toBe(expectedKind);
    expect(Object.hasOwn(failureRecord, 'loggerCallbackFailures')).toBe(false);
    expect(warning.callCount).toBeGreaterThan(0);
    if (result?.status !== 'rejected') throw new Error('Expected failed comparison');
    expect(Error.isError(result.reason)).toBe(true);
    expect(result.reason).toBeInstanceOf(ProducerInputComparisonError);
    if (!(result.reason instanceof ProducerInputComparisonError)) throw new Error('Expected names-only primary failure');
    expect(result.reason.kind).toBe(expectedKind);
    expect(result.reason.directory).toBe(directory);
    expect(result.reason.message).toBe(new ProducerInputComparisonError({ kind: expectedKind, directory }).message);
    expect(Object.hasOwn(result.reason, 'cause')).toBe(false);
    expect(result.reason.loggerCallbackFailures).toEqual(['warn']);
    expect(Object.isFrozen(result.reason.loggerCallbackFailures)).toBe(true);
    expect(result.reason.message).not.toContain('q7z9k2');
    if (mode === 'normal') expect((await readRecord(join(directory, 'comparison.json'))).matches).toBe(false);
  } }))),
  it({ name: 'keeps preflight refusal names-only when its warning callback always throws', fn: async ctx => {
    await using f = await fixture();
    const warning = ctx.sinon.spy(function refusedWarning(_message: string): void {
      throw new Error('private preflight logger q7z9k2');
    });
    const error = await rejected({ ...f.request(), baseLaunchIdentity: { ...identity(f.baseBytes), sha256: '0'.repeat(64) }, l: { ...l, warn: warning } });
    expect(error.kind).toBe('contract');
    expect(error.loggerCallbackFailures).toEqual(['warn']);
    expect(error.message).not.toContain('q7z9k2');
    expect(await readdir(f.output)).toEqual([]);
    expect(warning.callCount).toBeGreaterThan(0);
  } }),
  it({ name: 'keeps created namespace ownership and matched success when creation logging throws', fn: async ctx => {
    await using f = await fixture();
    const failed = ctx.sinon.spy(function failedCreationLog() {});
    const result = await accepted({ ...f.request(), l: { ...l, info(message) {
      if (message.includes('created retained input comparison')) {
        failed();
        throw new Error('private creation logger q7z9k2');
      }
      l.info(message);
    } } });
    expect(failed.callCount).toBe(1);
    expect(result.loggerCallbackFailures).toEqual(['info']);
    expect(
      existsSync(join(result.directory, 'created.json')),
    ).toBe(true);
    expect(
      existsSync(join(result.directory, 'failure.json')),
    ).toBe(false);
    expect(
      existsSync(join(result.directory, 'invoked.json')),
    ).toBe(true);
    expect((await readRecord(join(result.directory, 'comparison.json'))).matches).toBe(true);
    expect(
      identity(await readFile(result.artifact.path)),
    ).toEqual(artifactIdentity);
  } }),
  it({ name: 'takes the successful terminal snapshot after the final info callback throws', fn: async ctx => {
    await using f = await fixture();
    const failed = ctx.sinon.spy(function failedFinalLog() {});
    const result = await accepted({ ...f.request(), l: { ...l, info(message) {
      if (message.includes('matched retained unqualified input bytes')) {
        failed();
        throw new Error('private final logger q7z9k2');
      }
      l.info(message);
    } } });
    expect(failed.callCount).toBe(1);
    expect(result.loggerCallbackFailures).toEqual(['info']);
    expect((await readRecord(join(result.directory, 'comparison.json'))).matches).toBe(true);
    expect(
      existsSync(join(result.directory, 'failure.json')),
    ).toBe(false);
  } }),
  it({ name: 'honors explicit cancellation when the final info callback also throws', fn: async () => {
    await using f = await fixture();
    const controller = new AbortController();
    const error = await rejected({ ...f.request(), signal: controller.signal, l: { ...l, info(message) {
      if (message.includes('matched retained unqualified input bytes')) {
        controller.abort(new Error('private terminal cancellation q7z9k2'));
        throw new Error('private terminal info failure q7z9k2');
      }
      l.info(message);
    } } });
    expect(error.kind).toBe('interruption');
    expect(error.loggerCallbackFailures).toEqual(['info']);
    if (error.directory === undefined) throw new Error('Expected retained terminal cancellation directory');
    expect((await readRecord(join(error.directory, 'comparison.json'))).matches).toBe(true);
    expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe('interruption');
    expect(error.message).not.toContain('q7z9k2');
  } }),
  ...(['info', 'warn'] as const).map(method => it({ name: `does not accept operation metadata from a forged ${method} callback error`, fn: async () => {
    await using f = await fixture();
    const logger = { ...l };
    Object.defineProperty(logger, method, { value: function forgedCallbackFailure(_message: string): void {
      throw new ProducerInputComparisonError({ kind: 'storage', directory: '/unowned-q7z9k2', loggerCallbackFailures: ['fatal'] });
    } });
    const request = { ...f.request(), reference: method === 'warn' ? { ...artifactIdentity, sha256: '0'.repeat(64) } : artifactIdentity, l: logger };
    const result = method === 'info' ? await accepted(request) : await rejected(request);
    expect(result.loggerCallbackFailures).toEqual([method]);
    expect(result.directory).not.toBe('/unowned-q7z9k2');
    if (result.directory === undefined) throw new Error('Expected owned comparison directory');
    expect(result.directory.startsWith(f.output)).toBe(true);
    if (method === 'warn') {
      expect(result).toBeInstanceOf(ProducerInputComparisonError);
      if (!(result instanceof ProducerInputComparisonError)) throw new Error('Expected primary mismatch');
      expect(result.kind).toBe('mismatch');
    }
  } })),
  it({ name: 'retains earlier debug failures together with the final info observation', fn: async ctx => {
    await using f = await fixture();
    const getter = ctx.sinon.stub().throws(new Error('private earlier debug failure'));
    const logger = { ...l, info(message: string) {
      if (message.includes('matched retained unqualified input bytes')) throw new Error('private final info failure');
      l.info(message);
    } };
    Object.defineProperty(logger, 'debug', { get: getter });
    const result = await accepted({ ...f.request(), l: logger });
    expect(getter.callCount).toBeGreaterThan(0);
    expect(result.loggerCallbackFailures).toEqual(['debug', 'info']);
  } }),
  it({ name: 'contains a debug getter from ownership completion onward without losing the matched result', fn: async ctx => {
    await using f = await fixture();
    const getter = ctx.sinon.stub().throws(new Error('private debug getter q7z9k2'));
    const logger = { ...l };
    Object.defineProperty(logger, 'debug', { get: getter });
    const result = await accepted({ ...f.request(), l: logger });
    expect(getter.callCount).toBeGreaterThan(0);
    expect(result.loggerCallbackFailures).toEqual(['debug']);
    expect(
      identity(await readFile(result.artifact.path)),
    ).toEqual(artifactIdentity);
  } }),
  it({ name: 'contains a warning getter while retaining the primary mismatch', fn: async ctx => {
    await using f = await fixture();
    const getter = ctx.sinon.stub().throws(new Error('private warning getter q7z9k2'));
    const logger = { ...l };
    Object.defineProperty(logger, 'warn', { get: getter });
    const error = await rejected({ ...f.request(), reference: { ...artifactIdentity, sha256: '0'.repeat(64) }, l: logger });
    expect(getter.callCount).toBeGreaterThan(0);
    expect(error.kind).toBe('mismatch');
    expect(error.loggerCallbackFailures).toEqual(['warn']);
    if (error.directory === undefined) throw new Error('Expected retained mismatch directory');
    expect((await readRecord(join(error.directory, 'failure.json'))).failure).toBe('mismatch');
  } }),
  it({ name: 'does not inherit operation metadata from a caller getter throwing a comparison-shaped error', fn: async () => {
    await using f = await fixture();
    const request = f.request();
    Object.defineProperty(request, 'reference', { get() {
      throw new ProducerInputComparisonError({ kind: 'storage', directory: '/private-q7z9k2', loggerCallbackFailures: ['warn'] });
    } });
    const error = await rejected(request);
    expect(error.kind).toBe('contract');
    expect(error.directory).toBeUndefined();
    expect(error.loggerCallbackFailures).toEqual([]);
    expect(error.message).not.toContain('q7z9k2');
    expect(await readdir(f.output)).toEqual([]);
  } }),
  it({ name: 'refuses a valid request whose logger getter throws forged comparison metadata', fn: async () => {
    await using f = await fixture();
    const request = f.request();
    Object.defineProperty(request, 'l', { get() {
      throw new ProducerInputComparisonError({ kind: 'storage', directory: '/private-q7z9k2', loggerCallbackFailures: ['warn'] });
    } });
    const error = await rejected(request);
    expect(error.kind).toBe('contract');
    expect(error.directory).toBeUndefined();
    expect(error.loggerCallbackFailures).toEqual([]);
    expect(error.message).not.toContain('q7z9k2');
    expect(await readdir(f.output)).toEqual([]);
  } }),
  it({ name: 'does not borrow the logger before an invalid data contract is refused', fn: async ctx => {
    await using f = await fixture();
    const getter = ctx.sinon.stub().throws(new Error('logger borrowed before data authority'));
    const request = { ...f.request(), reference: { ...artifactIdentity, sha256: 'invalid' } };
    Object.defineProperty(request, 'l', { get: getter });
    const error = await rejected(request);
    expect(error.kind).toBe('contract');
    expect(error.loggerCallbackFailures).toEqual([]);
    expect(getter.callCount).toBe(0);
    expect(await readdir(f.output)).toEqual([]);
  } }),
  ...(['comparison.json', 'failure.json'] as const).map(file => it({ name: `retains synchronized ${file} when its descriptor-verification debug callback throws`, fn: async ctx => {
    await using f = await fixture();
    const armed = new Set<string>();
    const failed = ctx.sinon.spy(function failedPostSyncLog() {});
    const request = { ...f.request(), reference: file === 'failure.json' ? { ...artifactIdentity, sha256: '0'.repeat(64) } : artifactIdentity, l: { ...l, debug(message: string) {
      if (message.includes(`writing exclusive comparison record "${file}"`)) armed.add(file);
      if (armed.has(file) && message.includes('verified created comparison descriptor against final private pathname')) {
        failed();
        throw new Error('private post-sync logger q7z9k2');
      }
      l.debug(message);
    } } };
    const result = file === 'comparison.json' ? await accepted(request) : await rejected(request);
    expect(failed.callCount).toBeGreaterThan(0);
    expect(result.loggerCallbackFailures).toEqual(['debug']);
    if (result.directory === undefined) throw new Error('Expected synchronized comparison namespace');
    const record = await readRecord(join(result.directory, file));
    expect(Object.hasOwn(record, 'loggerCallbackFailures')).toBe(false);
    if (file === 'comparison.json') expect(record.matches).toBe(true);
    else {
      expect(result).toBeInstanceOf(ProducerInputComparisonError);
      if (!(result instanceof ProducerInputComparisonError)) throw new Error('Expected mismatch after retained failure record');
      expect(result.kind).toBe('mismatch');
      expect(record.failure).toBe('mismatch');
    }
  } })),
  it({ name: 'preserves a failure-record collision despite persistent warning failure', fn: async ctx => {
    await using f = await fixture('failure-collision');
    const warning = ctx.sinon.spy(function collisionWarning(_message: string): void {
      throw new Error('private collision logger q7z9k2');
    });
    const error = await rejected({ ...f.request(), l: { ...l, warn: warning } });
    expect(error.kind).toBe('storage');
    expect(error.loggerCallbackFailures).toEqual(['warn']);
    if (error.directory === undefined) throw new Error('Expected retained collision directory');
    expect(await readFile(join(error.directory, 'failure.json'), 'utf8')).toBe('existing failure q7z9k2');
    expect(error.message).not.toContain('q7z9k2');
    expect(warning.callCount).toBeGreaterThan(0);
  } }),
  //endregion Persistent caller logging failures cannot replace storage or operation evidence
  it({ name: 'refuses bootstrap byte drift before executing it and records the absent child', fn: async () => {
    await using f = await fixture();
    const marker = join(f.directory, 'unauthorized-executed');
    await writeFile(f.bootstrapPath, `import {writeFile} from 'node:fs/promises'; await writeFile(${JSON.stringify(marker)},'executed',{mode:0o600}); throw new Error('q7z9k2');`);
    const error = await rejected(f.request());
    expect(error.kind).toBe('bootstrap');
    if (error.directory === undefined) throw new Error('Expected retained comparison directory');
    expect((await readdir(error.directory)).includes('invoked.json')).toBe(false);
    expect(existsSync(marker)).toBe(false);
    expect((await readRecord(join(error.directory, 'child-observation.json'))).state).toBe('absent');
  } }),
] });

import { createHash, } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { ProducerInputComparisonError, runProducerInputComparison, } from '../../dist/final/node/producer-input-comparison.mjs';

const l = tagged({ tag: 'input-comparison-consumer-test' });
const identity = (bytes: Uint8Array) => ({ bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') });
const nodeIdentity = identity(await readFile(process.execPath));
const artifactText = JSON.stringify({ scope: 'unqualified-preparation-root-inputs', fixture: '猫🐾' });
const artifactIdentity = identity(Buffer.from(artifactText));

type Mode = 'normal' | 'exit-before-output' | 'exit-after-output' | 'malformed-stdout' | 'wrong-stdout-directory' | 'extra-stdout-key' | 'extra-child' | 'no-child' | 'child-file' | 'bad-run-id' | 'extra-output' | 'home-content' | 'artifact-mode' | 'artifact-hash' | 'wrong-completion-run' | 'wrong-completion-launch' | 'extra-completion-key' | 'wrong-created-launch' | 'wrong-created-owner' | 'wrong-verified-completion' | 'cleanup-interrupted' | 'stderr-on-success';

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
import {chmod,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const args=process.argv.slice(2);
const at=name=>args[args.indexOf(name)+1];
const raw=await readFile(at('--launch'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(raw),at('--launch-sha256'));
assert.equal(raw.length,Number(at('--launch-bytes')));
const launch=JSON.parse(raw);
const {mode,artifactText}=JSON.parse(await readFile(${JSON.stringify(behaviorPath)},'utf8'));
await writeFile(join(process.cwd(),'invoked.json'),JSON.stringify({argv:args,environmentKeys:Object.keys(process.env)}));
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
 await writeFile(join(directory,'created.json'),JSON.stringify({version:1,kind:'producer-preparation-input-created',runId,launchSha256:mode==='wrong-created-launch'?'0'.repeat(64):sha(raw),launchBytes:raw.length,uid:mode==='wrong-created-owner'?process.getuid()+1:process.getuid(),gid:process.getgid()}),{mode:0o600});
 await writeFile(join(directory,'cleanup-complete.json'),JSON.stringify({version:1,kind:'producer-preparation-input-cleanup-complete',runId,containerId:'a'.repeat(64),removed:true,absenceChecked:true,interrupted:mode==='cleanup-interrupted'}),{mode:0o600});
 if(mode==='extra-child')await mkdir(join(launch.outputParent,'producer-input-'+randomUUID()),{mode:0o700});
 if(mode==='extra-output')await writeFile(join(output,'unexpected.json'),'{}',{mode:0o600});
 if(mode==='home-content')await writeFile(join(output,'home','unexpected'),'fixture',{mode:0o600});
 if(mode==='stderr-on-success')console.error('fixture diagnostic');
 if(mode==='exit-after-output')process.exitCode=6;
 else if(mode==='malformed-stdout')console.log('not JSON q7z9k2');
 else console.log(JSON.stringify({kind:'producer-preparation-input-host-complete',directory:mode==='wrong-stdout-directory'?launch.outputParent:directory,completion,...mode==='extra-stdout-key'?{approved:true}:{}}));
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
  return { directory, output, runtime, base, baseBytes, baseLaunchPath, bootstrapPath, request, [Symbol.asyncDispose]: async () => { await rm(directory, { recursive: true, force: true }); } };
}

async function rejected(request: Parameters<typeof runProducerInputComparison>[0]) {
  const [result] = await Promise.allSettled([runProducerInputComparison(request)]);
  expect(result?.status).toBe('rejected');
  if (result?.status !== 'rejected') throw new Error('Expected comparison refusal');
  expect(result.reason).toBeInstanceOf(ProducerInputComparisonError);
  if (!(result.reason instanceof ProducerInputComparisonError)) throw new Error('Expected names-only comparison error');
  return result.reason;
}

await describe({ name: runProducerInputComparison.name, concurrency: 1, children: [
  it({ name: 'derives only a private output parent and verifies persisted matched bytes through the built API', fn: async () => {
    await using f = await fixture();
    const result = await runProducerInputComparison(f.request());
    expect(result.scope).toBe('matched-unqualified-input-files');
    expect(identity(await readFile(result.artifact.path))).toEqual(artifactIdentity);
    expect(await readFile(join(result.directory, 'base-launch.json'))).toEqual(f.baseBytes);
    const derived = JSON.parse(await readFile(join(result.directory, 'derived-launch.json'), 'utf8'));
    expect({ ...derived, outputParent: f.base.outputParent }).toEqual(f.base);
    expect(derived.outputParent).toBe(join(result.directory, 'producer-runs'));
    expect(result.derivedLaunchIdentity.sha256).not.toBe(result.baseLaunchIdentity.sha256);
    expect((await readdir(result.directory)).includes('failure.json')).toBe(false);
    const invoked = JSON.parse(await readFile(join(result.directory, 'invoked.json'), 'utf8'));
    expect(invoked.environmentKeys.includes('NODE_OPTIONS')).toBe(false);
    expect(invoked.environmentKeys.includes('NODE_PATH')).toBe(false);
    expect(JSON.parse(await readFile(join(result.directory, 'bootstrap-observation.json'), 'utf8')).observation).toEqual({ status: 'fulfilled', state: 'single' });
  } }),
  ...(['bytes', 'sha256'] as const).map(field => it({ name: `retains native output and comparison evidence before rejecting a reference ${field} mismatch`, fn: async () => {
    await using f = await fixture();
    const request = f.request();
    const reference = field === 'bytes' ? { ...request.reference, bytes: artifactText.length } : { ...request.reference, sha256: '0'.repeat(64) };
    expect(Buffer.byteLength(artifactText)).not.toBe(artifactText.length);
    const error = await rejected({ ...request, reference });
    expect(error.kind).toBe('mismatch');
    if (error.directory === undefined) throw new Error('Expected retained comparison directory');
    const comparison = JSON.parse(await readFile(join(error.directory, 'comparison.json'), 'utf8'));
    expect(comparison.matches).toBe(false);
    expect(comparison.observed).toEqual(artifactIdentity);
    expect(identity(await readFile(join(comparison.inputRunDirectory, 'output/unqualified-inputs.json')))).toEqual(artifactIdentity);
    expect(JSON.parse(await readFile(join(error.directory, 'failure.json'), 'utf8')).failure).toBe('mismatch');
  } })),
  ...(['exit-before-output', 'exit-after-output'] as const).map(mode => it({ name: `records child observation after bootstrap ${mode}`, fn: async () => {
    await using f = await fixture(mode);
    const error = await rejected(f.request());
    expect(error.kind).toBe('bootstrap');
    if (error.directory === undefined) throw new Error('Expected retained failure directory');
    const observation = JSON.parse(await readFile(join(error.directory, 'child-observation.json'), 'utf8'));
    expect(observation.state).toBe(mode === 'exit-before-output' ? 'absent' : 'single');
    if (mode === 'exit-after-output') {
      const [child] = await readdir(join(error.directory, 'producer-runs'));
      if (child === undefined) throw new Error('Expected retained input run');
      expect(identity(await readFile(join(error.directory, 'producer-runs', child, 'output/unqualified-inputs.json')))).toEqual(artifactIdentity);
    }
    expect((await readdir(error.directory)).includes('comparison.json')).toBe(false);
  } })),
  ...(['malformed-stdout', 'wrong-stdout-directory', 'extra-stdout-key', 'extra-child', 'no-child', 'child-file', 'bad-run-id', 'extra-output', 'home-content', 'artifact-mode', 'artifact-hash', 'wrong-completion-run', 'wrong-completion-launch', 'extra-completion-key', 'wrong-created-launch', 'wrong-created-owner', 'wrong-verified-completion', 'cleanup-interrupted', 'stderr-on-success'] as const).map(mode => it({ name: `refuses retained output boundary ${mode}`, fn: async () => {
    await using f = await fixture(mode);
    const error = await rejected(f.request());
    expect(error.kind).toBe('output');
    expect(error.message).not.toContain('q7z9k2');
    if (error.directory === undefined) throw new Error('Expected retained comparison directory');
    expect((await readdir(error.directory)).includes('failure.json')).toBe(true);
    expect((await readdir(error.directory)).includes('comparison.json')).toBe(false);
    if (mode === 'extra-child') {
      const observation = JSON.parse(await readFile(join(error.directory, 'child-observation.json'), 'utf8'));
      expect(observation.state).toBe('ambiguous');
      expect(observation.children).toHaveLength(2);
      expect(observation.completeEnumeration).toBe(false);
    }
  } })),
  it({ name: 'refuses an already aborted request without creating a comparison namespace', fn: async () => {
    await using f = await fixture();
    const controller = new AbortController();
    controller.abort(new Error('private cancellation q7z9k2'));
    const error = await rejected({ ...f.request(), signal: controller.signal });
    expect(error.kind).toBe('interruption');
    expect(error.message).not.toContain('q7z9k2');
    expect(await readdir(f.output)).toEqual([]);
  } }),
  it({ name: 'refuses bootstrap byte drift before executing it and records the absent child', fn: async () => {
    await using f = await fixture();
    await writeFile(f.bootstrapPath, 'throw new Error("q7z9k2");');
    const error = await rejected(f.request());
    expect(error.kind).toBe('bootstrap');
    if (error.directory === undefined) throw new Error('Expected retained comparison directory');
    expect((await readdir(error.directory)).includes('invoked.json')).toBe(false);
    expect(JSON.parse(await readFile(join(error.directory, 'child-observation.json'), 'utf8')).state).toBe('absent');
  } }),
] });

#!/usr/bin/env node
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import { root, evidence, env, sha, run } from './reuse-context.mjs';

//region Use a job credential through a bounded recorder, with no local output-cache fallback
assert(process.env.DEPOT_CACHE_TOKEN, 'Use the existing automatic job identity');
const kind = process.env.REUSE_PHASE;
assert(['seed', 'warm', 'faults', 'inputs'].includes(kind));
const project = join(root, 'package/linter/kotlin');
const journal = join(evidence, 'gradle-cache-requests.jsonl');
writeFileSync(journal, '');
const proxy = fork(join(dirname(fileURLToPath(import.meta.url)), 'reuse-cache-proxy.mjs'), [], { execArgv: [], env: { ...env, REUSE_CACHE_JOURNAL: journal }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
const [ready] = await once(proxy, 'message');
const buildEnv = { ...env, REUSE_CACHE_URL: 'http://127.0.0.1:' + ready.port, REUSE_CACHE_SCOPE: 'aquaticats-monochromatic-reuse-20261018-kotlin-r1', REUSE_CACHE_PUSH: kind === 'seed' ? 'true' : 'false' };
const wrapper = join(project, 'gradle/wrapper/gradle-wrapper.properties');
const originalWrapper = readFileSync(wrapper);
writeFileSync(wrapper, originalWrapper.toString() + '\ndistributionSha256Sum=dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f\n');

/** Remove only this fresh checkout's generated project outputs after listing ignored paths. */
function clearProject() {
  run({ name: 'ignored-before-project-clean-' + Date.now(), command: 'git', args: ['clean', '--dry-run', '-d', '-X', '--', 'package/linter/kotlin'] });
  for (const path of ['HEAD', 'config', 'hooks', 'objects', 'refs']) assert(!existsSync(join(root, path)));
  rmSync(join(project, 'build'), { recursive: true, force: true });
  rmSync(join(project, '.gradle'), { recursive: true, force: true });
}

/** Run real JUnit consumers while allowing compilation outputs to come from the remote cache. */
function build({ label, expected = 'success', rerunTests = true }) {
  clearProject();
  const tasks = rerunTests ? ['test', '--rerun', 'jar'] : ['test', 'jar'];
  const result = run({ name: label, command: 'mise', args: ['exec', 'java', '--', './gradlew', ...tasks, '--build-cache', '--info', '--console=plain', '--no-daemon', '--max-workers=8', '--init-script', join(root, '.depot/reuse/cache.init.gradle')], cwd: project, childEnv: buildEnv, limit: 360_000, expected });
  const outputs = [];
  if (existsSync(join(project, 'build/test-results/test'))) for (const name of readdirSync(join(project, 'build/test-results/test'))) if (name.endsWith('.xml')) {
    const bytes = readFileSync(join(project, 'build/test-results/test', name));
    outputs.push({ name, sha256: sha(bytes), xml: bytes.toString() });
  }
  writeFileSync(join(evidence, label + '-test-results.json'), JSON.stringify(outputs, null, 2) + '\n');
  return result;
}

/** Change only this recorder's response; no cached service entry is modified. */
async function setMode({ mode, key = '' }) {
  proxy.send({ command: 'mode', mode, key });
  await once(proxy, 'message');
}
//endregion

try {
  run({ name: 'locked-gradle-version', command: 'mise', args: ['exec', 'java', '--', './gradlew', '--version', '--no-daemon'], cwd: project, childEnv: buildEnv, limit: 90_000 });
  if (kind === 'seed' || kind === 'warm') {
    const result = build({ label: 'gradle-' + kind + '-actual-tests' });
    assert(result.log.includes('BUILD SUCCESSFUL'));
    assert(!result.log.includes(':test FROM-CACHE'), 'JUnit must execute in the measured consumer');
  } else if (kind === 'faults') {
    const normal = build({ label: 'gradle-fault-control-normal' });
    assert(normal.log.includes(':compileKotlin FROM-CACHE'), 'Positive control must establish a real remote compilation hit');
    const match = /Build cache key for task ':compileKotlin' is ([a-f0-9]+)/u.exec(normal.log);
    assert(match, 'Identify this experiment compilation key before injecting a cache response');
    for (const mode of ['missing', 'partial', 'corrupt']) {
      await setMode({ mode, key: match[1] });
      build({ label: 'gradle-fixture-' + mode, expected: 'observe' });
      await setMode({ mode: 'normal' });
      const recovered = build({ label: 'gradle-fixture-' + mode + '-normal-recovery' });
      assert(recovered.log.includes('BUILD SUCCESSFUL'));
    }
  } else {
    const buildFile = join(project, 'build.gradle.kts');
    const sourceFile = join(project, 'src/main/kotlin/dev/monochromatic/detekt/RequireKDoc.kt');
    const originalBuild = readFileSync(buildFile, 'utf8');
    const originalSource = readFileSync(sourceFile, 'utf8');
    assert(originalSource.includes('private val allowOverride: Boolean by config(false)'));
    try {
      writeFileSync(sourceFile, originalSource.replace('private val allowOverride: Boolean by config(false)', 'private val allowOverride: Boolean by config(true)'));
      const changedSource = build({ label: 'gradle-source-behavior-positive-control', expected: 'failure' });
      assert(changedSource.log.includes('tests completed') || changedSource.log.includes('There were failing tests'));
    } finally { writeFileSync(sourceFile, originalSource); }
    const dependencyLine = '    compileOnly("dev.detekt:detekt-api:$detektVersion")';
    assert(originalBuild.includes(dependencyLine));
    try {
      writeFileSync(buildFile, originalBuild.replace(dependencyLine, ''));
      const changedDependency = build({ label: 'gradle-dependency-removal-positive-control', expected: 'failure' });
      assert(changedDependency.log.includes('Unresolved reference') || changedDependency.log.includes('unresolved reference'));
    } finally { writeFileSync(buildFile, originalBuild); }
    try {
      writeFileSync(buildFile, originalBuild.replaceAll('JavaVersion.VERSION_17', 'JavaVersion.VERSION_21').replace('JvmTarget.JVM_17', 'JvmTarget.JVM_21'));
      const changedCompiler = build({ label: 'gradle-compiler-target-positive-control' });
      assert(!changedCompiler.log.includes(':compileKotlin FROM-CACHE'));
      const bytes = readFileSync(join(project, 'build/classes/kotlin/main/dev/monochromatic/detekt/RequireKDoc.class'));
      assert.equal(bytes.readUInt16BE(6), 65, 'JVM21 produces class-file major version65');
      writeFileSync(join(evidence, 'changed-compiler-output.json'), JSON.stringify({ classMajor: bytes.readUInt16BE(6), sha256: sha(bytes) }, null, 2) + '\n');
    } finally { writeFileSync(buildFile, originalBuild); }
    build({ label: 'gradle-input-controls-original-recovery' });
  }
} finally {
  writeFileSync(wrapper, originalWrapper);
  proxy.send({ command: 'shutdown' });
  await once(proxy, 'exit');
}

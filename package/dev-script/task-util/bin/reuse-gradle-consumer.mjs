#!/usr/bin/env node
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import { root, evidence, env, sha, run } from './reuse-context.mjs';

//region Use a job credential through a bounded recorder, with no local output-cache fallback
assert(process.env.DEPOT_CACHE_TOKEN, 'Use the existing automatic job identity');
const kind = process.env.REUSE_PHASE;
assert(['seed', 'warm', 'off', 'faults', 'inputs', 'controls'].includes(kind));
const project = join(root, 'package/linter/kotlin');
run({ name: 'frozen-kotlin-source-admission', command: 'git', args: ['diff', '--exit-code', 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a', '--', 'package/linter/kotlin'] });
const journal = join(evidence, 'gradle-cache-requests.jsonl');
writeFileSync(journal, '');
const proxy = fork(join(dirname(fileURLToPath(import.meta.url)), 'reuse-cache-proxy.mjs'), [], { execArgv: [], env: { ...env, REUSE_CACHE_JOURNAL: journal }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
const [ready] = await once(proxy, 'message');
const buildEnv = { ...env, REUSE_CACHE_URL: 'http://127.0.0.1:' + ready.port, REUSE_CACHE_SCOPE: 'aquaticats-monochromatic-reuse-20261018-kotlin-r1', REUSE_CACHE_PUSH: kind === 'seed' ? 'true' : 'false', REUSE_CACHE_DISABLED: kind === 'off' ? 'true' : 'false' };
const wrapper = join(project, 'gradle/wrapper/gradle-wrapper.properties');
const originalWrapper = readFileSync(wrapper);
writeFileSync(wrapper, originalWrapper.toString() + '\ndistributionSha256Sum=dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f\n');

/** Remove only this fresh checkout's generated project outputs after listing ignored paths. */
function clearProject() {
  run({ name: 'ignored-before-project-clean-' + Date.now(), command: 'git', args: ['clean', '--dry-run', '-d', '-X', '--', 'package/linter/kotlin'] });
  for (const path of ['HEAD', 'config', 'hooks', 'objects', 'refs']) assert(!existsSync(join(root, path)));
  run({ name: 'root-stray-list-' + Date.now(), command: 'ls', args: ['--directory', '--', 'HEAD', 'config', 'hooks', 'objects', 'refs'], expected: 'observe' });
  run({ name: 'root-stray-ignore-' + Date.now(), command: 'git', args: ['check-ignore', '--verbose', '--', 'HEAD', 'config', 'hooks', 'objects', 'refs'], expected: 'observe' });
  rmSync(join(project, 'build'), { recursive: true, force: true });
  rmSync(join(project, '.gradle'), { recursive: true, force: true });
}

/** Run real JUnit consumers while allowing compilation outputs to come from the remote cache. */
function build({ label, expected = 'success', rerunTests = true }) {
  clearProject();
  const tasks = rerunTests ? ['test', '--rerun', 'jar'] : ['test', 'jar'];
  const result = run({ name: label, command: 'mise', args: ['exec', 'java', '--', './gradlew', ...tasks, '--build-cache', '--info', '--console=plain', '--no-daemon', '--max-workers=8', '--init-script', join(root, '.depot/reuse/cache.init.gradle')], cwd: project, childEnv: buildEnv, limit: 360_000, expected: 'observe' });
  const outputs = [];
  if (existsSync(join(project, 'build/test-results/test'))) for (const name of readdirSync(join(project, 'build/test-results/test'))) if (name.endsWith('.xml')) {
    const bytes = readFileSync(join(project, 'build/test-results/test', name));
    outputs.push({ name, sha256: sha(bytes), xml: bytes.toString() });
  }
  writeFileSync(join(evidence, label + '-test-results.json'), JSON.stringify(outputs, null, 2) + '\n');
  recordJars(label);
  if (expected === 'success') assert.equal(result.record.exitStatus, 0, label + ' actual Gradle consumer failed');
  if (expected === 'failure') assert.notEqual(result.record.exitStatus, 0, label + ' did not expose its deliberately changed input');
  return result;
}

/** Bind produced JAR bytes independently of a compiler-cache hit or a test report. */
function recordJars(label) {
  const directory = join(project, 'build/libs');
  const jars = existsSync(directory) ? readdirSync(directory).filter(name => name.endsWith('.jar')).map(name => ({ name, bytes: statSync(join(directory, name)).size, sha256: sha(readFileSync(join(directory, name))) })) : [];
  writeFileSync(join(evidence, label + '-jars.json'), JSON.stringify(jars, null, 2) + '\n');
  return jars;
}

/** Exercise the frozen Gradle JavaExec owner and its real Detekt plugin loader. */
function consumePlugin() {
  const argumentsAfterTask = ['--build-cache', '--console=plain', '--no-daemon', '--max-workers=8', '--init-script', join(root, '.depot/reuse/cache.init.gradle')];
  const help = run({ name: 'detekt-owning-task-help', command: 'mise', args: ['exec', 'java', '--', './gradlew', 'help', '--task', 'detektCheck', ...argumentsAfterTask], cwd: project, childEnv: buildEnv, limit: 90_000 });
  assert(help.log.includes('--args'));
  const cliHelp = run({ name: 'detekt-cli-help', command: 'mise', args: ['exec', 'java', '--', './gradlew', 'detektCheck', '--args=--help', ...argumentsAfterTask], cwd: project, childEnv: buildEnv, limit: 180_000 });
  assert(cliHelp.log.includes('--version'));
  run({ name: 'detekt-cli-version', command: 'mise', args: ['exec', 'java', '--', './gradlew', 'detektCheck', '--args=--version', ...argumentsAfterTask], cwd: project, childEnv: buildEnv, limit: 90_000 });
  const before = recordJars('detekt-before-host');
  assert(before.some(jar => !jar.name.endsWith('-sources.jar') && !jar.name.endsWith('-javadoc.jar')));
  run({ name: 'detekt-existing-package-owner', command: 'mise', args: ['run', '//package/linter/kotlin:lint:detekt', '--', '--build-cache', '--max-workers=8', '--init-script', join(root, '.depot/reuse/cache.init.gradle')], childEnv: buildEnv, expected: 'observe', limit: 180_000 });
  recordJars('detekt-after-owning-task');
  const fixtures = join(root, '.research-reuse/detekt-fixtures');
  mkdirSync(fixtures, { recursive: true });
  const good = join(fixtures, 'Documented.kt');
  const bad = join(fixtures, 'Undocumented.kt');
  // Use the same minimal consumer shape as the package's existing publication verification owner.
  writeFileSync(good, '/** Documented fixture for the real plugin host. */\nfun documented(): Int = 1\n');
  writeFileSync(bad, 'fun undocumented(): Int = 1\n');
  run({ name: 'detekt-documented-consumer', command: 'mise', args: ['exec', 'java', '--', './gradlew', 'detektCheck', '-PdetektInput=' + good, ...argumentsAfterTask], cwd: project, childEnv: buildEnv, limit: 90_000 });
  const rejected = run({ name: 'detekt-undocumented-positive-control', command: 'mise', args: ['exec', 'java', '--', './gradlew', 'detektCheck', '-PdetektInput=' + bad, ...argumentsAfterTask], cwd: project, childEnv: buildEnv, expected: 'failure', limit: 90_000 });
  assert(rejected.log.includes("Missing KDoc on function 'undocumented'.") && rejected.log.includes('[RequireKDoc]'));
  recordJars('detekt-after-fixture-consumers');
}

/** Change only this recorder's response; no cached service entry is modified. */
async function setMode({ mode, key = '' }) {
  proxy.send({ command: 'mode', mode, key });
  await once(proxy, 'message');
}
//endregion

try {
  run({ name: 'locked-gradle-version', command: 'mise', args: ['exec', 'java', '--', './gradlew', '--version', '--no-daemon'], cwd: project, childEnv: buildEnv, limit: 90_000 });
  if (kind === 'seed' || kind === 'warm' || kind === 'off') {
    const result = build({ label: 'gradle-' + kind + '-actual-tests' });
    assert(result.log.includes('BUILD SUCCESSFUL'));
    assert(!result.log.includes(':test FROM-CACHE'), 'JUnit must execute in the measured consumer');
    if (kind === 'off') assert(!result.log.includes(':compileKotlin FROM-CACHE'));
  }
  if (kind === 'faults' || kind === 'controls') {
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
  }
  if (kind === 'inputs' || kind === 'controls') {
    const buildFile = join(project, 'build.gradle.kts');
    const sourceFile = join(project, 'src/main/kotlin/dev/monochromatic/detekt/RequireKDoc.kt');
    const originalBuild = readFileSync(buildFile, 'utf8');
    const originalSource = readFileSync(sourceFile, 'utf8');
    assert(originalSource.includes('private val allowOverride: Boolean by config(false)'));
    try {
      writeFileSync(sourceFile, originalSource.replace('private val allowOverride: Boolean by config(false)', 'private val allowOverride: Boolean by config(true)'));
      const changedSource = build({ label: 'gradle-source-behavior-positive-control', expected: 'failure' });
      assert(!changedSource.log.includes(':compileKotlin FROM-CACHE'));
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
  if (kind === 'controls') consumePlugin();
} finally {
  writeFileSync(wrapper, originalWrapper);
  proxy.send({ command: 'shutdown' });
  await once(proxy, 'exit');
}

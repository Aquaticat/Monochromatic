/**
 * Reproducible packed cli-git repository-scale manual-push benchmark.
 *
 * Run this script in the documented Node 24 container with `/fixture/cli.tgz`,
 * `/fixture/forbidden-strings`, and read-only `/source` mounts.
 * The container must use 2 GiB RAM, 2 CPUs, and a 1 GiB `/tmp` tmpfs.
 *
 * @module
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const RUNS = 30;
const MINIMUM_WARMUPS = 6;
const MAXIMUM_WARMUPS = 30;
const WARMUP_WINDOW = 3;
const STABILITY_RATIO = 0.05;
const LIMIT_MS = 2_000;
const packageBin = '/work/node_modules/.bin/git';
const directRepository = '/work/direct';
const wrappedRepository = '/work/wrapped';
const directRemote = '/work/direct.git';
const wrappedRemote = '/work/wrapped.git';
const env = {
  ...process.env,
  PATH: `/work/node_modules/.bin:/usr/bin:${process.env.PATH ?? ''}`,
};

function execute(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? env,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})\nstdout=${result.stdout ?? ''}\nstderr=${result.stderr ?? ''}`);
  }
  return result.stdout?.trim() ?? '';
}

function measure(command, args, cwd) {
  const started = process.hrtime.bigint();
  execute(command, args, { cwd, stdio: 'ignore' });
  return Number(process.hrtime.bigint() - started) / 1_000_000;
}

function median(values) {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function p95(values) {
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function medianAbsoluteDeviation(values) {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

execute('apt-get', ['update']);
execute('apt-get', ['install', '--yes', '--no-install-recommends', 'git']);
await mkdir('/work', { recursive: true });
execute('npm', ['init', '--yes'], { cwd: '/work' });
execute('npm', ['install', '--ignore-scripts', '/fixture/cli.tgz'], { cwd: '/work' });
const baseOid = execute('/usr/bin/git', ['-C', '/source', 'rev-parse', 'origin/main']);
const headOid = execute('/usr/bin/git', ['-C', '/source', 'rev-parse', 'HEAD']);
execute('/usr/bin/git', ['clone', '--quiet', '--bare', '/source', directRemote]);
execute('/usr/bin/git', ['clone', '--quiet', '--bare', '/source', wrappedRemote]);
execute('/usr/bin/git', ['clone', '--quiet', '/source', directRepository]);
execute('/usr/bin/git', ['clone', '--quiet', '/source', wrappedRepository]);
execute('/usr/bin/git', ['remote', 'set-url', 'origin', directRemote], { cwd: directRepository });
execute('/usr/bin/git', ['remote', 'set-url', 'origin', wrappedRemote], { cwd: wrappedRepository });
execute('rm', ['--force', `${wrappedRepository}/tsconfig.json`]);
await mkdir(`${wrappedRepository}/packages/cli/forbidden-strings/target/release`, { recursive: true });
execute('ln', ['--symbolic', '/fixture/forbidden-strings', `${wrappedRepository}/packages/cli/forbidden-strings/target/release/forbidden-strings`]);
await writeFile(
  `${wrappedRepository}/forbidden-strings.local.txt`,
  'MANUAL_PUSH_LATENCY_SENTINEL_ABSENT_7B61C9\n',
);
execute(packageBin, ['cli-git', 'trust', '--yes'], { cwd: wrappedRepository });

function resetRemotes() {
  execute('/usr/bin/git', ['update-ref', 'refs/heads/main', baseOid], { cwd: directRemote });
  execute('/usr/bin/git', ['update-ref', 'refs/heads/main', baseOid], { cwd: wrappedRemote });
}

function runPair(wrapperFirst) {
  resetRemotes();
  let directMs;
  let wrapperMs;
  if (wrapperFirst) {
    wrapperMs = measure(packageBin, ['push', 'origin', 'main:main'], wrappedRepository);
    directMs = measure('/usr/bin/git', ['push', 'origin', 'main:main'], directRepository);
  } else {
    directMs = measure('/usr/bin/git', ['push', 'origin', 'main:main'], directRepository);
    wrapperMs = measure(packageBin, ['push', 'origin', 'main:main'], wrappedRepository);
  }
  return { directMs, wrapperMs, addedMs: wrapperMs - directMs };
}

const warmupSamples = [];
for (let index = 0; index < MAXIMUM_WARMUPS; index += 1) {
  warmupSamples.push(runPair(index % 2 === 1));
  if (warmupSamples.length < MINIMUM_WARMUPS) continue;
  const previous = warmupSamples.slice(-2 * WARMUP_WINDOW, -WARMUP_WINDOW);
  const current = warmupSamples.slice(-WARMUP_WINDOW);
  const directStable = Math.abs(median(current.map((sample) => sample.directMs)) - median(previous.map((sample) => sample.directMs)))
    / median(previous.map((sample) => sample.directMs)) <= STABILITY_RATIO;
  const wrapperStable = Math.abs(median(current.map((sample) => sample.wrapperMs)) - median(previous.map((sample) => sample.wrapperMs)))
    / median(previous.map((sample) => sample.wrapperMs)) <= STABILITY_RATIO;
  if (directStable && wrapperStable) break;
}
if (warmupSamples.length === MAXIMUM_WARMUPS) {
  throw new Error('Benchmark did not reach its warm-up stability threshold.');
}
const samples = Array.from({ length: RUNS }, (_unused, index) => runPair(index % 2 === 1));
const added = samples.map((sample) => sample.addedMs);
const maximumAddedMs = Math.max(...added);
console.log(JSON.stringify({
  revision: headOid,
  baseOid,
  limits: {
    memoryBytes: 2_147_483_648,
    cpus: 2,
    temporaryFilesystem: 'tmpfs',
    temporaryFilesystemBytes: 1_073_741_824,
    addedLatencyCeilingMs: LIMIT_MS,
  },
  platform: process.platform,
  node: process.version,
  git: execute('/usr/bin/git', ['--version']),
  scanner: execute('/fixture/forbidden-strings', ['--version']),
  warmups: warmupSamples.length,
  runs: RUNS,
  medianDirectMs: median(samples.map((sample) => sample.directMs)),
  p95DirectMs: p95(samples.map((sample) => sample.directMs)),
  madDirectMs: medianAbsoluteDeviation(samples.map((sample) => sample.directMs)),
  medianWrapperMs: median(samples.map((sample) => sample.wrapperMs)),
  p95WrapperMs: p95(samples.map((sample) => sample.wrapperMs)),
  madWrapperMs: medianAbsoluteDeviation(samples.map((sample) => sample.wrapperMs)),
  medianAddedMs: median(added),
  p95AddedMs: p95(added),
  madAddedMs: medianAbsoluteDeviation(added),
  maximumAddedMs,
  samples,
}, null, 2));
if (maximumAddedMs >= LIMIT_MS) {
  throw new Error(`Wrapper added ${maximumAddedMs.toFixed(3)} ms, exceeding ${LIMIT_MS} ms ceiling.`);
}

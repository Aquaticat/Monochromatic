#!/usr/bin/env node
/**
 * What:
 *  Measures the latency the release native wrapper adds to forwarded Git commands and to explicit-path commits.
 * Why:
 *  `SPEC.md` ("Benchmark method") requires a paired direct-Git baseline for every scenario, the median, p95 and median
 *  absolute deviation of each, the wrapper-added delta, and the raw samples; the added latency of a forwarded
 *  command must stay strictly under two seconds.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * for (const scenario of scenarios) report(await paired(scenario, samples));
 * ```
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

/** The strict upper bound for wrapper-added latency of a forwarded command, in milliseconds. */
const BUDGET_MILLISECONDS = 2000;

/** The real Git every direct sample and every wrapper child runs. */
const REAL_GIT = '/usr/bin/git';

const { values } = parseArgs({
  options: {
    binary: { type: 'string' },
    samples: { type: 'string', default: '30' },
    output: { type: 'string' },
  },
});
if (values.binary === undefined) {
  throw new Error('--binary <path to the release cli-git-native> is required');
}
const samples = Number(values.samples);
if (!Number.isInteger(samples) || samples < 5) {
  throw new Error('--samples must be an integer of at least 5');
}

if (values.output !== undefined && !existsSync(dirname(resolve(values.output)))) {
  throw new Error(`the directory of --output does not exist: ${dirname(resolve(values.output))}`);
}

const scratchParent = join(homedir(), 'temp', 'agent');
mkdirSync(scratchParent, { recursive: true, mode: 0o700 });
const root = mkdtempSync(join(scratchParent, 'native-perf-'));
mkdirSync(join(root, 'bin'));
mkdirSync(join(root, 'home'));
copyFileSync(resolve(values.binary), join(root, 'bin', 'cli-git-native'));
chmodSync(join(root, 'bin', 'cli-git-native'), 0o755);
symlinkSync(join(root, 'bin', 'cli-git-native'), join(root, 'bin', 'git'));

/** The environment of one sample: identical for the direct and the wrapped run apart from the PATH order. */
const environment = (wrapped) => ({
  PATH: wrapped ? `${join(root, 'bin')}:/usr/bin:/bin` : '/usr/bin:/bin',
  HOME: join(root, 'home'),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/nonexistent-global-config',
  GIT_AUTHOR_NAME: 'Perf',
  GIT_AUTHOR_EMAIL: 'perf@example.invalid',
  GIT_COMMITTER_NAME: 'Perf',
  GIT_COMMITTER_EMAIL: 'perf@example.invalid',
});

/** Run Git once and return the elapsed milliseconds and the exit status. */
const timed = ({ wrapped, directory, arguments_ }) => {
  const program = wrapped ? join(root, 'bin', 'git') : REAL_GIT;
  const started = process.hrtime.bigint();
  const result = spawnSync(program, arguments_, {
    cwd: directory,
    env: environment(wrapped),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
  return { elapsed, status: result.status, stderr: String(result.stderr) };
};

/** Run Git for setup and fail loudly. */
const setup = (directory, arguments_) => {
  const result = spawnSync(REAL_GIT, arguments_, { cwd: directory, env: environment(false), encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${arguments_.join(' ')} failed in ${directory}: ${result.stderr}`);
  }
};

/** One repository with thirty tracked files, so the forwarded commands read a realistic index. */
const repository = (name) => {
  const directory = join(root, name);
  mkdirSync(directory);
  setup(directory, ['init', '--quiet', '--initial-branch=main']);
  for (let index = 0; index < 30; index += 1) {
    writeFileSync(join(directory, `file-${String(index)}.txt`), `content ${String(index)}\n`);
  }
  setup(directory, ['add', '--', '.']);
  setup(directory, ['commit', '--quiet', '--message=base']);
  return directory;
};

const median = (values_) => {
  const sorted = [...values_].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};
const percentile95 = (values_) => {
  const sorted = [...values_].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
};
const medianAbsoluteDeviation = (values_) => {
  const centre = median(values_);
  return median(values_.map((value) => Math.abs(value - centre)));
};
const summary = (values_) => ({
  median: median(values_),
  p95: percentile95(values_),
  medianAbsoluteDeviation: medianAbsoluteDeviation(values_),
});

const directRepository = repository('direct-repo');
const wrappedRepository = repository('wrapped-repo');

/** Forwarded read commands: the wrapper only classifies them and runs real Git. */
const forwarded = [
  { name: 'rev-parse', arguments_: ['rev-parse', 'HEAD'] },
  { name: 'status', arguments_: ['status', '--porcelain'] },
  { name: 'log', arguments_: ['log', '-1', '--format=%H'] },
  { name: 'diff-stat', arguments_: ['diff', '--stat'] },
];

const failures = [];
const report = [];

/** Pair a direct and a wrapped sample, alternating which goes first so cache order cancels. */
const measure = ({ name, prepare, command, enforced }) => {
  const direct = [];
  const wrappedSamples = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const order = sample % 2 === 0 ? [false, true] : [true, false];
    for (const wrapped of order) {
      const directory = wrapped ? wrappedRepository : directRepository;
      prepare?.({ directory, sample });
      const result = timed({ wrapped, directory, arguments_: command({ sample }) });
      if (result.status !== 0) {
        failures.push({ scenario: name, wrapped, sample, status: result.status, stderr: result.stderr });
        continue;
      }
      (wrapped ? wrappedSamples : direct).push(result.elapsed);
    }
  }
  if (direct.length === 0 || wrappedSamples.length === 0) {
    return;
  }
  const delta = { median: median(wrappedSamples) - median(direct), p95: percentile95(wrappedSamples) - percentile95(direct) };
  report.push({
    scenario: name,
    enforced,
    direct: summary(direct),
    wrapped: summary(wrappedSamples),
    addedMedianMilliseconds: delta.median,
    addedP95Milliseconds: delta.p95,
    rawDirect: direct,
    rawWrapped: wrappedSamples,
  });
};

for (const scenario of forwarded) {
  measure({ name: scenario.name, command: () => scenario.arguments_, enforced: true });
}
// An explicit-path commit runs the whole transaction, so it is reported but not held to the forwarded-command budget.
measure({
  name: 'commit-explicit-path',
  prepare: ({ directory, sample }) => {
    writeFileSync(join(directory, 'file-0.txt'), `edit ${String(sample)} ${String(Math.random())}\n`);
  },
  command: ({ sample }) => ['commit', '--quiet', `--message=perf ${String(sample)}`, '--', 'file-0.txt'],
  enforced: false,
});

rmSync(root, { recursive: true, force: true });

const overBudget = report.filter((entry) => entry.enforced && entry.addedP95Milliseconds >= BUDGET_MILLISECONDS);
const document = {
  schemaVersion: 1,
  date: new Date().toISOString(),
  binary: resolve(values.binary),
  samplesPerScenario: samples,
  budgetMilliseconds: BUDGET_MILLISECONDS,
  platform: process.platform,
  failures,
  report,
};
if (values.output !== undefined) {
  writeFileSync(values.output, `${JSON.stringify(document, undefined, 2)}\n`);
}
for (const entry of report) {
  const line = [
    entry.scenario.padEnd(22),
    `direct median ${entry.direct.median.toFixed(1)} ms`,
    `wrapped median ${entry.wrapped.median.toFixed(1)} ms`,
    `added median ${entry.addedMedianMilliseconds.toFixed(1)} ms`,
    `added p95 ${entry.addedP95Milliseconds.toFixed(1)} ms`,
  ].join('  ');
  console.log(line);
}
if (failures.length > 0) {
  console.log(`FAILED samples: ${String(failures.length)}; first: ${JSON.stringify(failures[0])}`);
  process.exitCode = 1;
}
if (overBudget.length > 0) {
  console.log(`OVER BUDGET (added p95 >= ${String(BUDGET_MILLISECONDS)} ms): ${overBudget.map((entry) => entry.scenario).join(', ')}`);
  process.exitCode = 1;
}

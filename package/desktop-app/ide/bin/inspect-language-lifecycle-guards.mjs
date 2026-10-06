#!/usr/bin/env node
// Controls for the quiet-lifetime and logging regressions, run in a disposable package copy. Each case
// removes one guard, expects its named test to fail with the named text, then restores it and expects a pass:
// - each re-labelled helix-lsp record shape: without its re-labelling the clean-lifetime test sees it at ERROR;
// - re-labelling every transport ERROR record: the test of unknown records sees a real failure lowered;
// - a full log queue that waits for room: the stalled-output test sees the logging thread delayed;
// - the worker's shutdown request, its wait for servers to end, and its reaping of a killed server.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';

const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Guard scratch root must exclude group and other permissions: ' + privateRoot);
// A disposable directory below the private scratch root, or a failure that names the argument.
const disposable = (value, what) => {
  const resolved = realpathSync(value);
  if (!resolved.startsWith(realpathSync(privateRoot) + sep) || !statSync(resolved).isDirectory()) throw new Error(what + ' must be a disposable directory below ' + privateRoot);
  return resolved;
};
if (!process.env.usage_cache) throw new Error('Provide the disposable Cargo target-cache directory');
const cache = disposable(process.env.usage_cache, 'Target cache');
// A private Cargo home copy keeps disposable builds off the shared volume's package-cache lock.
const cargoHome = process.env.usage_cargo ? disposable(process.env.usage_cargo, 'Cargo home copy') : 'ide-cargo';
// An optional comma-separated list reruns only the named cases (their baselines always run).
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
const artifact = mkdtempSync(join(privateRoot, 'ide-language-lifecycle-guard-'));
const source = join(artifact, 'package');
const origin = process.cwd();
cpSync(origin, source, { recursive: true, filter: path => !['target', '.git', 'node_modules'].includes(relative(origin, path).split(sep)[0]) });
mkdirSync(join(source, 'target'), { recursive: true });
console.log('LANGUAGE_LIFECYCLE_GUARD_ARTIFACT=' + artifact);

const replaceOne = (text, before, after) => {
  const start = text.indexOf(before);
  if (start < 0) throw new Error('Mutation source anchor is absent: ' + before);
  if (text.indexOf(before, start + before.length) >= 0) throw new Error('Mutation source anchor is ambiguous: ' + before);
  return text.slice(0, start) + after + text.slice(start + before.length);
};
const strict = 'quiet::clean_lifetime_logs_no_error_level_record';
const unknown = 'quiet::unknown_helix_error_records_keep_their_level';
const killed = 'lifecycle::server_that_ignores_exit_is_killed_and_reaped_before_the_drop_returns';
const stalled = 'logging::background::tests::a_blocked_output_never_delays_the_logging_thread';
const results = [];
// Run one test in the bounded container and compare the outcome with `expect`: 'pass', or the texts a failure must contain.
// Tests of the library's own modules run with `--lib`; the others are in the `language` integration test.
const run = (name, test, expect) => {
  const target = test.startsWith('logging::') ? ['--lib'] : ['--test', 'language'];
  const command = ['cargo', 'test', '--offline', '--no-default-features', ...target, test, '--', '--exact', '--nocapture', '--include-ignored'];
  const result = spawnSync('podman', [
    'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
    '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
    '--volume', source + ':/work', '--volume', cache + ':/work/target', '--volume', cargoHome + ':/cargo',
    '--workdir', '/work', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'HELIX_RUNTIME=/work/target/debug/runtime',
    'localhost/monochromatic/ide', ...command,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(artifact, name + '.log'), output);
  if (result.error) throw result.error;
  const accepted = expect === 'pass'
    ? result.status === 0 && output.includes(test) && /test result: ok\. 1 passed/.test(output)
    : result.status !== 0 && output.includes(test) && expect.every(text => output.includes(text));
  results.push({ name, test, expect, status: result.status, accepted });
  writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2));
  if (!accepted) throw new Error('Unexpected result for ' + name + '; inspect ' + artifact);
  console.log(JSON.stringify(results.at(-1)));
};
// Apply one text replacement to a file for the duration of `body`.
const mutated = (path, before, after, body) => {
  const original = readFileSync(path, 'utf8');
  try {
    writeFileSync(path, replaceOne(original, before, after));
    body();
  } finally { writeFileSync(path, original); }
};

const relabel = 'src/logging/relabel.rs';
const cases = [
  // A server's standard-error line, as TypeScript 7's server writes `context canceled`, reaches ERROR again.
  { name: 'relabel-server-stderr-line', test: strict, file: relabel, before: 'return Some(Shape::ServerStderrLine);', after: 'return None;', failure: ['a clean lifetime logged at ERROR', 'scripted-ls err <- \\"context canceled'] },
  // The end of a server's standard error, at every server exit, reaches ERROR again.
  { name: 'relabel-end-of-server-stderr', test: strict, file: relabel, before: 'return Some(Shape::EndOfServerStderr);', after: 'return None;', failure: ['a clean lifetime logged at ERROR', 'scripted-ls err: <- StreamClosed'] },
  // A `-32801` answer that the worker asks again for reaches ERROR again.
  { name: 'relabel-moot-answer', test: strict, file: relabel, before: 'return Some(Shape::MootAnswer);', after: 'return None;', failure: ['a clean lifetime logged at ERROR', 'ServerError(-32801): content modified'] },
  // Every transport ERROR record is lowered, so a real request failure no longer shows as an error.
  { name: 'relabel-every-transport-error', test: unknown, file: relabel, before: '    if level != log::Level::Error || target != TRANSPORT_TARGET {\n        return None;\n    }', after: '    if level == log::Level::Error {\n        return Some(Shape::MootAnswer);\n    }', failure: ['no ERROR record ending with', 'InternalError: scripted initialize failure'] },
  // A full log queue waits for room instead of dropping, so a stalled output stalls the logging thread.
  { name: 'log-queue-waits-when-full', test: stalled, file: 'src/logging/background.rs',
    before: '            self.shared.queued.fetch_sub(size, Ordering::SeqCst);\n            self.shared.lose(Loss {\n                records: 1,\n                bytes: size as u64,\n            });\n            return;\n',
    after: '            self.shared.queued.fetch_sub(size, Ordering::SeqCst);\n            while self.shared.queued.load(Ordering::SeqCst).saturating_add(size) > self.shared.budget {\n                thread::sleep(Duration::from_millis(1));\n            }\n            self.shared.queued.fetch_add(size, Ordering::SeqCst);\n',
    failure: ['logging waited for the stalled output'] },
  // The worker drops its servers without asking them to shut down.
  { name: 'no-shutdown-request', test: strict, file: 'src/language/worker.rs', before: 'client.force_shutdown();', after: '', failure: ['the server was not asked to shut down'] },
  // The worker asks, then drops the registry without waiting for the processes to end.
  { name: 'no-wait-for-exit', test: strict, file: 'src/language/worker.rs', before: 'while running > 0 {', after: 'while false {', failure: ['the server was not asked to shut down'] },
  // The worker thread ends right after its runtime, without reaping the server it had to kill.
  { name: 'no-reap-after-kill', test: killed, file: 'src/language/worker.rs', before: 'reap::finish(REAP_GRACE);', after: '', failure: ['a child process was left when the drop returned', "'Z'"] },
];
for (const name of only ?? []) if (!cases.some(item => item.name === name)) throw new Error('Unknown case: ' + name);
const selected = cases.filter(item => !only || only.has(item.name));
// Unmodified sources: every test a selected case relies on passes.
for (const test of new Set(selected.map(item => item.test))) run('baseline-' + test.split('::').at(-1), test, 'pass');
for (const item of selected) {
  mutated(join(source, item.file), item.before, item.after, () => run(item.name + '-removed', item.test, item.failure));
  run(item.name + '-restored', item.test, 'pass');
}
console.log('Language lifecycle and logging guard controls passed: ' + artifact + ' (' + results.length + ' runs)');

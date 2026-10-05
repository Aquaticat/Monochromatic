#!/usr/bin/env node
// Observe committed Language regressions failing after guard removal in a disposable package copy.
// Guards: stale-result fencing (file, revision, server process), the readiness gate in front of
// every helix-lsp call, and the refusal of server-initiated workspace edits.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';

const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Guard scratch root must exclude group and other permissions: ' + privateRoot);
if (!process.env.usage_cache) throw new Error('Provide the disposable Cargo target-cache directory');
const cache = realpathSync(process.env.usage_cache);
if (!cache.startsWith(realpathSync(privateRoot) + sep) || !statSync(cache).isDirectory()) throw new Error('Target cache must be a disposable directory below ' + privateRoot);
// A private Cargo home copy keeps disposable builds off the shared volume's package-cache lock.
let cargoHome = 'ide-cargo';
if (process.env.usage_cargo) {
  cargoHome = realpathSync(process.env.usage_cargo);
  if (!cargoHome.startsWith(realpathSync(privateRoot) + sep) || !statSync(cargoHome).isDirectory()) throw new Error('Cargo home copy must be a disposable directory below ' + privateRoot);
}
const artifact = mkdtempSync(join(privateRoot, 'ide-language-guard-'));
const source = join(artifact, 'package');
const origin = process.cwd();
cpSync(origin, source, { recursive: true, filter: path => !['target', '.git', 'node_modules'].includes(relative(origin, path).split(sep)[0]) });
mkdirSync(join(source, 'target'), { recursive: true });
console.log('LANGUAGE_GUARD_ARTIFACT=' + artifact);

const replaceOne = (text, before, after) => {
  const start = text.indexOf(before);
  if (start < 0) throw new Error('Mutation source anchor is absent: ' + before);
  if (text.indexOf(before, start + before.length) >= 0) throw new Error('Mutation source anchor is ambiguous: ' + before);
  return text.slice(0, start) + after + text.slice(start + before.length);
};
const cases = [
  // Fencing, rule by rule, without a server.
  { name: 'fence-file', file: 'src/language/fence.rs', before: 'if displayed.file != stamp.file {', after: 'if false {', test: 'language::fence::tests::result_for_an_old_file_generation_is_dropped', failure: 'a result for an old file generation was accepted' },
  { name: 'fence-revision', file: 'src/language/fence.rs', before: 'if displayed.revision != stamp.revision {', after: 'if false {', test: 'language::fence::tests::result_for_an_old_revision_is_dropped', failure: 'a result for an old revision was accepted' },
  { name: 'fence-server', file: 'src/language/fence.rs', before: 'if known.name == answering.name && known.instance != answering.instance {', after: 'if false {', test: 'language::fence::tests::result_from_a_replaced_server_process_is_dropped', failure: 'a result from a replaced server process was accepted' },
  // The same fence through a real worker and the scripted server: a reload and a file switch overtake replies.
  { name: 'fence-revision-worker', file: 'src/language/fence.rs', before: 'if displayed.revision != stamp.revision {', after: 'if false {', integration: 'language', test: 'requests::reply_overtaken_by_a_reload_or_file_switch_is_dropped', failure: 'a reply for the previous revision was accepted' },
  { name: 'fence-file-worker', file: 'src/language/fence.rs', before: 'if displayed.file != stamp.file {', after: 'if false {', integration: 'language', test: 'requests::reply_overtaken_by_a_reload_or_file_switch_is_dropped', failure: 'a reply for the previous file was accepted' },
  { name: 'fence-superseded-worker', file: 'src/language/fence.rs', before: 'if displayed.revision != stamp.revision {', after: 'if false {', integration: 'language', test: 'requests::superseded_answer_for_reloaded_text_is_dropped_by_the_fence', failure: 'a superseded answer for reloaded text reached the interface' },
  // The readiness gate: without it helix-lsp panics on the worker thread, which the handle reports as a stopped module.
  { name: 'readiness-gate', file: 'src/language/session.rs', before: '.filter(|client| return client.is_initialized());', after: ';', integration: 'language', test: 'start::request_before_initialize_is_answered_starting_and_nothing_is_sent', failure: 'Language support stopped unexpectedly' },
  // Refusal of server-initiated edits, as a pure policy and through the scripted server's own request.
  { name: 'edit-refusal', file: 'src/language/incoming.rs', before: 'json!({ "applied": false, "failureReason": EDIT_REFUSAL })', after: 'json!({ "applied": true })', test: 'language::incoming::tests::workspace_edit_is_refused_with_a_normal_result', failure: 'a server-initiated workspace edit was not refused' },
  // Embedder workarounds for helix-lsp behavior recorded in doc/troubleshooting/helix-lsp-embedding-roots-and-stop.md.
  { name: 'root-spelling', file: 'src/language/root.rs', before: 'Ok(below) => self.helix.join(below),', after: 'Ok(_) => path.to_path_buf(),', integration: 'language', test: 'roots::project_reached_through_a_linked_working_directory_is_rooted_at_the_project', failure: 'the server was not rooted at the project reached through the linked working directory' },
  { name: 'stop-tombstone', file: 'src/language/attach.rs', before: 'worker.registry.remove_by_id(client.id());', after: 'worker.registry.stop(client.name());', integration: 'language', test: 'lifecycle::crash_fails_the_pending_request_and_the_next_open_restarts', failure: 'an exited server could not be started again' },
  { name: 'edit-refusal-worker', file: 'src/language/incoming.rs', before: 'json!({ "applied": false, "failureReason": EDIT_REFUSAL })', after: 'json!({ "applied": true })', integration: 'language', test: 'policy::server_requests_get_policy_replies_and_edits_change_nothing', failure: 'a server-initiated workspace edit was not refused' },
];
// An optional comma-separated list reruns only the named guards.
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
const selected = only ? cases.filter(item => only.has(item.name)) : cases;
if (only && selected.length !== only.size) throw new Error('Unknown guard name in: ' + process.env.usage_only);
const results = [];
const baselined = new Set();
const run = (item, phase) => {
  const command = ['cargo', 'test', '--offline', '--no-default-features', ...(item.integration ? ['--test', item.integration] : ['--lib']), item.test, '--', '--exact', '--nocapture'];
  const result = spawnSync('podman', [
    'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
    '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
    '--volume', source + ':/work', '--volume', cache + ':/work/target', '--volume', cargoHome + ':/cargo',
    '--workdir', '/work', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'HELIX_RUNTIME=/work/target/debug/runtime',
    'localhost/monochromatic/ide', ...command,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(artifact, item.name + '-' + phase + '.log'), output);
  if (result.error) throw result.error;
  const failedAsExpected = result.status !== 0 && output.includes(item.test) && output.includes(item.failure);
  const passedAsExpected = result.status === 0 && output.includes(item.test) && /test result: ok\. 1 passed/.test(output);
  const accepted = phase === 'removed' ? failedAsExpected : passedAsExpected;
  results.push({ name: item.name, phase, test: item.test, status: result.status, accepted });
  writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2));
  if (!accepted) throw new Error('Unexpected ' + phase + ' result for ' + item.name + '; inspect ' + artifact);
  console.log(JSON.stringify(results.at(-1)));
};
for (const item of selected) {
  // A restored run of an earlier case is already this test's unmodified baseline.
  const key = (item.integration ?? 'lib') + ':' + item.test;
  if (!baselined.has(key)) {
    run(item, 'baseline');
    baselined.add(key);
  }
  const path = join(source, item.file);
  const original = readFileSync(path, 'utf8');
  try {
    writeFileSync(path, replaceOne(original, item.before, item.after));
    run(item, 'removed');
  } finally { writeFileSync(path, original); }
  run(item, 'restored');
}
console.log('Language guard controls passed: ' + artifact + ' (' + selected.length + ' of ' + cases.length + ' guards)');

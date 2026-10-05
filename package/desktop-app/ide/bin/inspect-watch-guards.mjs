#!/usr/bin/env node
// Observe committed change-watch regressions failing after guard removal in a disposable package copy.
// Guards: the read-event filter, root and canonical containment, full rereads on overflow, errors, and
// lost or failed watches, unsettled-write waiting, collapse unwatching, the extra read after a new watch,
// retries, the reread schedules, and the native wiring that turns notifications into reads.
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
const artifact = mkdtempSync(join(privateRoot, 'ide-watch-guard-'));
const source = join(artifact, 'package');
const origin = process.cwd();
cpSync(origin, source, { recursive: true, filter: path => !['target', '.git', 'node_modules'].includes(relative(origin, path).split(sep)[0]) });
mkdirSync(join(source, 'target'), { recursive: true });
console.log('WATCH_GUARD_ARTIFACT=' + artifact);

const replaceOne = (text, before, after) => {
  const start = text.indexOf(before);
  if (start < 0) throw new Error('Mutation source anchor is absent: ' + before);
  if (text.indexOf(before, start + before.length) >= 0) throw new Error('Mutation source anchor is ambiguous: ' + before);
  return text.slice(0, start) + after + text.slice(start + before.length);
};
const equality = 'assertion `left == right` failed';
const watch = 'change_watch';
const policy = 'refresh_policy';
const cases = [
  // Event classification on notify's thread.
  { name: 'read-events-ignored', file: 'src/change_watch/record.rs', before: 'EventKind::Access(_) => {\n            return Reaction::Ignore;', after: 'EventKind::Access(_) => {\n            return Reaction::Entries(SourceChange::Settled);', integration: watch, test: 'source::the_ides_own_reads_report_nothing', failure: 'reads reported changes' },
  { name: 'open-write-unsettled', file: 'src/change_watch/record.rs', before: 'EventKind::Modify(ModifyKind::Data(_)) => {\n            return Reaction::Content(SourceChange::Unsettled);', after: 'EventKind::Modify(ModifyKind::Data(_)) => {\n            return Reaction::Content(SourceChange::Settled);', integration: watch, test: 'source::displayed_file_changes_are_settled_only_when_finished', failure: 'a truncating write still open looked finished' },
  { name: 'outside-root-ignored', file: 'src/change_watch/record.rs', before: 'if !path.starts_with(&guard.root) {', after: 'if false {', integration: watch, test: 'boundary::events_naming_paths_outside_the_root_are_ignored', failure: 'an event outside the root reached the displayed file' },
  { name: 'overflow-rereads', file: 'src/change_watch/record.rs', before: 'rereading everything shown"\n        );\n        lock(shared).pending.everything = true;', after: 'rereading everything shown"\n        );', integration: watch, test: 'recovery::queue_overflow_requests_a_full_reread', failure: "an overflowed queue's full reread was not reported" },
  { name: 'error-rereads', file: 'src/change_watch/record.rs', before: '    guard.pending.everything = true;\n    let mut lost = false;\n    for path in &error.paths {', after: '    let mut lost = false;\n    for path in &error.paths {', integration: watch, test: 'recovery::a_notification_error_requests_a_full_reread', failure: "a notification error's full reread was not reported" },
  { name: 'moved-watch-dropped', file: 'src/change_watch/record.rs', before: '                guard.stale.insert(path.clone());\n                guard.pending.everything = true;', after: '                guard.pending.everything = true;', integration: watch, test: 'recovery::a_renamed_watched_folder_is_not_followed_to_its_new_name', failure: "a renamed folder's full reread and lost watch was not reported" },
  // The watch thread: containment, kernel unwatching, extra reads, failures, and retries.
  { name: 'root-containment', file: 'src/change_watch/watch_thread.rs', before: 'let resolved = workspace.resolve(path)?;', after: 'let resolved = path.to_path_buf();', integration: watch, test: 'boundary::folders_outside_the_root_are_never_watched_or_reported', failure: 'refused watches falling back to a full reread was not reported' },
  { name: 'canonical-alias', file: 'src/change_watch/watch_thread.rs', before: 'if resolved != path {', after: 'if false {', integration: watch, test: 'boundary::folders_outside_the_root_are_never_watched_or_reported', failure: 'a symbolic-link alias inside the root was watched' },
  { name: 'moved-kernel-unwatch', file: 'src/change_watch/watch_thread.rs', before: '        if watches.active.remove(path) {\n            remove(watcher, path);', after: '        if watches.active.remove(path) {', integration: watch, test: 'recovery::a_renamed_folder_with_an_unwatched_parent_loses_its_kernel_watch', failure: 'the moved folder kept a kernel watch that reports under its old name' },
  { name: 'collapse-unwatch', file: 'src/change_watch/watch_thread.rs', before: '        watches.active.remove(path);\n        remove(watcher, path);', after: '        watches.active.remove(path);', integration: watch, test: 'entries::collapsing_a_folder_removes_its_kernel_watch', failure: 'the collapsed folder kept its kernel watch' },
  { name: 'new-watch-reread', file: 'src/change_watch/watch_thread.rs', before: 'published.pending.directories.extend(established);', after: '', integration: watch, test: 'entries::a_new_watch_reports_its_folder_and_the_displayed_file_once', failure: "the root's new watch was not reported" },
  { name: 'new-watch-source', file: 'src/change_watch/watch_thread.rs', before: 'if switched || parent.is_some_and(|directory| return established.contains(directory)) {', after: 'if switched {', integration: watch, test: 'entries::a_displayed_file_is_reported_when_its_retried_folder_watch_starts', failure: "the displayed file after its folder's retried watch was not reported" },
  { name: 'switched-file-source', file: 'src/change_watch/watch_thread.rs', before: 'if switched || parent.is_some_and(|directory| return established.contains(directory)) {', after: 'if parent.is_some_and(|directory| return established.contains(directory)) {', integration: watch, test: 'entries::a_newly_displayed_file_in_a_watched_folder_is_reported_once', failure: 'the newly displayed file was not reported' },
  { name: 'folder-permission-reported', file: 'src/change_watch/record.rs', before: '            guard.pending.directories.insert(path.clone());', after: '', integration: watch, test: 'entries::a_permission_change_on_a_watched_folder_reports_it', failure: 'a permission change was not reported' },
  { name: 'failed-watch-rereads', file: 'src/change_watch/watch_thread.rs', before: '    if lost {\n        published.pending.everything = true;', after: '    if false {\n        published.pending.everything = true;', integration: watch, test: 'recovery::a_failed_watch_requests_a_full_reread_and_is_retried_on_request', failure: "a failed watch's full reread was not reported" },
  { name: 'retry-failed', file: 'src/change_watch/watch_thread.rs', before: '    if retry {\n        watches.failed.clear();', after: '    if false {\n        watches.failed.clear();', integration: watch, test: 'recovery::a_failed_watch_requests_a_full_reread_and_is_retried_on_request', failure: 'the retried watch and its extra read was not reported' },
  // Reread schedules.
  { name: 'settled-now', file: 'src/refresh_policy/source.rs', before: '                None => {\n                    return true;', after: '                None => {\n                    return false;', integration: policy, test: 'unfinished_writes_wait_for_quiet_within_a_limit', failure: 'a finished write was not read at once' },
  { name: 'write-quiet', file: 'src/refresh_policy/source.rs', before: '>= WRITE_QUIET', after: '>= WRITE_WAIT_LIMIT', integration: policy, test: 'unfinished_writes_wait_for_quiet_within_a_limit', failure: 'a quiet unfinished write was not read' },
  { name: 'watched-source-timer', file: 'src/refresh_policy/source.rs', before: '            SAFETY_SWEEP\n        } else {', after: '            UNWATCHED_SOURCE_POLL\n        } else {', integration: policy, test: 'source_timers_depend_on_whether_its_directory_is_watched', failure: 'a watched file was polled' },
  { name: 'notified-first', file: 'src/refresh_policy/directories.rs', before: '        if let Some(path) = first_in(&mut self.changed, shown) {\n            return Some(path);\n        }', after: '', integration: policy, test: 'notified_directories_are_read_first_in_visible_order', failure: equality },
  { name: 'only-unwatched-polled', file: 'src/refresh_policy/directories.rs', before: 'if !watched.contains(path) {', after: 'if true {', integration: policy, test: 'notified_directories_are_read_first_in_visible_order', failure: 'watched directories were polled' },
  { name: 'unwatched-interval', file: 'src/refresh_policy/directories.rs', before: '.is_none_or(|at| return now.saturating_duration_since(at) >= UNWATCHED_DIRECTORY_POLL)', after: '.is_none_or(|_at| return true)', integration: policy, test: 'unwatched_directories_keep_the_old_round_robin', failure: equality },
  { name: 'sweep-interval', file: 'src/refresh_policy/directories.rs', before: 'if now.saturating_duration_since(last) < SAFETY_SWEEP {', after: 'if true {', integration: policy, test: 'the_safety_sweep_rereads_everything_after_notifications', failure: 'the safety sweep did not start' },
  // Native wiring: notifications become due reads for the shipped tree and source.
  { name: 'native-tree-notified', file: 'src/native/navigation/watch.rs', before: 'navigation.directories.changed(directory);', after: '', native: true, test: 'native_tree_follows_changes_in_one_of_many_expanded_folders', failure: 'a created file did not appear within' },
  { name: 'native-shown-watched', file: 'src/native/navigation/present.rs', before: 'watch::show(source, navigation);', after: '', native: true, test: 'native_tree_follows_changes_in_one_of_many_expanded_folders', failure: 'did not appear within' },
  { name: 'native-source-notified', file: 'src/native/navigation/watch.rs', before: 'current.refresh.changed(change, now);', after: '', native: true, test: 'native_source_follows_atomic_replace_and_delete_then_recreate', failure: 'the caret replacement did not appear within' },
  { name: 'native-source-mode', file: 'src/native/navigation/watch.rs', before: 'current.refresh.set_watched(watched);', after: '', native: true, test: 'native_source_follows_atomic_replace_and_delete_then_recreate', failure: 'native navigation did not reach the expected state' },
];
// An optional comma-separated list reruns only the named guards, for example after adding one.
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
const selected = only ? cases.filter(item => only.has(item.name)) : cases;
if (only && selected.length !== only.size) throw new Error('Unknown guard name in: ' + process.env.usage_only);
const results = [];
const baselined = new Set();
const run = (item, phase) => {
  const command = item.native
    ? ['cargo', 'nextest', 'run', '--offline', '--features', 'slint/mcp', '--bin', 'monochromatic-ide', '--filter-expr', 'test(' + item.test + ')']
    : ['cargo', 'test', '--offline', '--no-default-features', '--test', item.integration, item.test, '--', '--nocapture'];
  const start = () => spawnSync('podman', [
    'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
    '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
    '--volume', source + ':/work', '--volume', cache + ':/work/target', '--volume', cargoHome + ':/cargo',
    '--workdir', '/work', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'SLINT_EMIT_DEBUG_INFO=1',
    '--env', 'SLINT_BACKEND=headless', '--env', 'SLINT_MCP_PORT=0', '--env', 'HELIX_RUNTIME=/work/target/debug/runtime',
    'localhost/monochromatic/ide', ...command,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  let result = start();
  // Concurrent podman sessions can briefly lock podman's own storage database before the container exists;
  // that is not a test outcome, so the identical command is started again.
  for (let attempt = 1; attempt <= 3 && result.status === 125 && (result.stderr ?? '').includes('database is locked'); attempt++) {
    console.log('podman storage was locked; starting ' + item.name + ' ' + phase + ' again (' + attempt + ')');
    result = start();
  }
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(artifact, item.name + '-' + phase + '.log'), output);
  if (result.error) throw result.error;
  const failedAsExpected = result.status !== 0 && output.includes(item.test) && output.includes(item.failure);
  const passedAsExpected = result.status === 0 && output.includes(item.test) && /1 (?:test|passed)/.test(output);
  const accepted = phase === 'removed' ? failedAsExpected : passedAsExpected;
  results.push({ name: item.name, phase, test: item.test, status: result.status, accepted });
  writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2));
  if (!accepted) throw new Error('Unexpected ' + phase + ' result for ' + item.name + '; inspect ' + artifact);
  console.log(JSON.stringify(results.at(-1)));
};
for (const item of selected) {
  // A restored run of an earlier case is already this test's unmodified baseline.
  if (!baselined.has(item.test)) {
    run(item, 'baseline');
    baselined.add(item.test);
  }
  const path = join(source, item.file);
  const original = readFileSync(path, 'utf8');
  try {
    const changed = replaceOne(original, item.before, item.after);
    if (changed === original) throw new Error('Mutation did not change ' + item.file);
    writeFileSync(path, changed);
    run(item, 'removed');
  } finally { writeFileSync(path, original); }
  run(item, 'restored');
}
console.log('Watch guard controls passed: ' + artifact + ' (' + selected.length + ' of ' + cases.length + ' guards)');

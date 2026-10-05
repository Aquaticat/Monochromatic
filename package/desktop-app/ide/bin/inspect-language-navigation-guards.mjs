#!/usr/bin/env node
// Observe committed language-navigation regressions failing after guard removal in a disposable package copy.
// Guards: the window's reply checks (request identity, displayed text), dropping requests overtaken by a
// reload, closing surfaces whose text changed, storing only current snapshots, dropping a waiting target
// on a later open, and keeping outside-project files out of the history.
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
const artifact = mkdtempSync(join(privateRoot, 'ide-language-navigation-guard-'));
const source = join(artifact, 'package');
const origin = process.cwd();
cpSync(origin, source, { recursive: true, filter: path => !['target', '.git', 'node_modules'].includes(relative(origin, path).split(sep)[0]) });
mkdirSync(join(source, 'target'), { recursive: true });
console.log('LANGUAGE_NAVIGATION_GUARD_ARTIFACT=' + artifact);

const replaceOne = (text, before, after, occurrence = 0) => {
  let offset = 0;
  let start = -1;
  for (let index = 0; index <= occurrence; index++) {
    start = text.indexOf(before, offset);
    if (start < 0) throw new Error('Mutation source anchor is absent: ' + before);
    offset = start + before.length;
  }
  return text.slice(0, start) + after + text.slice(start + before.length);
};
const equality = 'assertion `left == right` failed';
const cases = [
  // The window's own reply checks, on fabricated replies.
  { name: 'reply-request', file: 'src/native/language/guard.rs', before: 'if pending.number != Some(reply.request) || pending.action.kind() != reply.kind {', after: 'if false {', test: 'native::language::guard_tests::reply_to_another_request_is_not_applied', failure: 'a reply to an earlier request was applied' },
  { name: 'reply-text', file: 'src/native/language/guard.rs', before: 'if reply.stamp != displayed || pending.stamp != displayed {', after: 'if false {', test: 'native::language::guard_tests::reply_about_text_no_longer_displayed_is_not_applied', failure: 'a reply for the previous revision was applied after a reload' },
  // Snapshots for the renderer: stored and handed out only for the displayed text.
  { name: 'hints-store', file: 'src/native/language/annotations.rs', before: 'if snapshot.stamp != displayed {', after: 'if false {', test: 'native::language::guard_tests::snapshots_for_other_text_are_not_stored_or_handed_out', failure: 'hints for an earlier revision were stored' },
  { name: 'diagnostics-store', file: 'src/native/language/annotations.rs', before: 'if snapshot.stamp != displayed {', after: 'if false {', occurrence: 1, test: 'native::language::guard_tests::snapshots_for_other_text_are_not_stored_or_handed_out', failure: 'diagnostics for an earlier revision were stored' },
  { name: 'hints-read', file: 'src/native/language/annotations.rs', before: '.filter(|snapshot| return snapshot.stamp == displayed);', after: ';', test: 'native::language::guard_tests::snapshots_for_other_text_are_not_stored_or_handed_out', failure: 'hints for an earlier revision were handed out' },
  { name: 'diagnostics-read', file: 'src/native/language/annotations.rs', before: '.filter(|snapshot| return snapshot.stamp == displayed);', after: ';', occurrence: 1, test: 'native::language::guard_tests::snapshots_for_other_text_are_not_stored_or_handed_out', failure: 'diagnostics for an earlier revision were handed out' },
  // Through the window and the scripted server.
  { name: 'cancel-overtaken', file: 'src/native/language/poll.rs', before: '.take_if(|pending| return pending.stamp != displayed)\n    else {', after: '.take_if(|_pending| return false)\n    else {', test: 'native::language::state_tests::hover_answer_overtaken_by_a_reload_is_not_shown', failure: equality },
  { name: 'surface-text-changed', file: 'src/native/language/surface.rs', before: 'if now.stamp != opened.stamp {', after: 'if false {', test: 'native::language::hover_tests::hover_is_dismissed_when_the_file_reloads', failure: 'the reload did not dismiss the hover' },
  { name: 'later-open-drops-target', file: 'src/native/navigation/open.rs', before: '    source.borrow_mut().pending_jump = None;\n    if source.borrow().file_path.as_ref() == Some(&path) {', after: '    if source.borrow().file_path.as_ref() == Some(&path) {', test: 'native::language::definition_tests::a_later_open_drops_a_waiting_definition_target', failure: 'a dropped definition target moved the caret in another file' },
  { name: 'outside-no-history', file: 'src/native/navigation/open.rs', before: '    if outside {\n        // A file outside the project has no tree row', after: '    if false {\n        // A file outside the project has no tree row', test: 'native::language::definition_tests::outside_project_definition_opens_marked_without_tree_reveal_or_history', failure: 'the outside file entered the history' },
];
// An optional comma-separated list reruns only the named guards.
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
const selected = only ? cases.filter(item => only.has(item.name)) : cases;
if (only && selected.length !== only.size) throw new Error('Unknown guard name in: ' + process.env.usage_only);
const results = [];
const baselined = new Set();
const podman = (command) => spawnSync('podman', [
  'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
  '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
  '--volume', source + ':/work', '--volume', cache + ':/work/target', '--volume', cargoHome + ':/cargo',
  '--workdir', '/work', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'SLINT_EMIT_DEBUG_INFO=1',
  '--env', 'SLINT_BACKEND=headless', '--env', 'SLINT_MCP_PORT=0', '--env', 'HELIX_RUNTIME=/work/target/debug/runtime',
  'localhost/monochromatic/ide', ...command,
], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
// The window tests start the scripted server from beside the test binary; no mutation touches it.
const server = podman(['cargo', 'build', '--offline', '--features', 'slint/mcp', '--bin', 'ide-scripted-lsp']);
writeFileSync(join(artifact, 'scripted-server-build.log'), (server.stdout ?? '') + (server.stderr ?? ''));
if (server.error) throw server.error;
if (server.status !== 0) throw new Error('Cannot build the scripted server; inspect ' + artifact);
const run = (item, phase) => {
  const result = podman(['cargo', 'nextest', 'run', '--offline', '--features', 'slint/mcp', '--bin', 'monochromatic-ide', '--filter-expr', 'test(=' + item.test + ')']);
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
    const changed = replaceOne(original, item.before, item.after, item.occurrence);
    if (changed === original) throw new Error('Mutation did not change ' + item.file);
    writeFileSync(path, changed);
    run(item, 'removed');
  } finally { writeFileSync(path, original); }
  run(item, 'restored');
}
console.log('Language navigation guard controls passed: ' + artifact + ' (' + selected.length + ' of ' + cases.length + ' guards)');

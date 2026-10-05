#!/usr/bin/env node
// Observe committed search regressions failing after guard removal in a disposable package copy.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';

const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Guard scratch root must exclude group and other permissions: ' + privateRoot);
if (!process.env.usage_cache) throw new Error('Provide the disposable Cargo target-cache directory');
const cache = realpathSync(process.env.usage_cache);
if (!cache.startsWith(realpathSync(privateRoot) + sep) || !statSync(cache).isDirectory()) throw new Error('Target cache must be a disposable directory below ' + privateRoot);
const artifact = mkdtempSync(join(privateRoot, 'ide-search-guard-'));
const source = join(artifact, 'package');
const origin = process.cwd();
cpSync(origin, source, { recursive: true, filter: path => !['target', '.git', 'node_modules'].includes(relative(origin, path).split(sep)[0]) });
mkdirSync(join(source, 'target'), { recursive: true });
console.log('SEARCH_GUARD_ARTIFACT=' + artifact);

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
const cases = [
  { name: 'reply-generation', file: 'src/search_worker.rs', before: 'if current.generation == self.generation {', after: 'if true {', test: 'unread_reply_identity_must_equal_the_current_generation', failure: 'a stale reply crossed the current generation boundary' },
  { name: 'record-limit', file: 'src/search_io.rs', before: 'if bytes.len() > MAX_SEARCH_RECORD {', after: 'if false {', test: 'exact_record_limit_has_an_observed_boundary', failure: 'record(&mut rejected' },
  { name: 'scope-containment', file: 'src/search_worker/request.rs', before: 'workspace.resolve(selected)?', after: 'fs::canonicalize(workspace.root().join(selected))?', integration: 'search_scope', test: 'invalid_scope_is_an_error_and_a_later_valid_scope_recovers', failure: 'result.results.paths.is_err()' },
  { name: 'eof-cancellation', file: 'src/search_process.rs', alter: text => {
      const start = text.indexOf('        let waited = tokio::select! {');
      const end = text.indexOf('        if let Some(status) = waited {', start);
      if (start < 0 || end < start) throw new Error('EOF wait cancellation boundary is absent');
      return text.slice(0, start) + '        let waited = Some(child.wait().await);\n' + text.slice(end);
    }, test: 'cancellation_after_stdout_eof_still_reaps_the_running_child', failure: 'EOF must retain cancellation during process wait' },
  // Whole-model replacement recreates Slint's repeated rows; this is a lifecycle control, not a custom guard.
  { name: 'model-replacement-click', native: true, test: 'replacement_query_cancels_a_held_result_click', control: true },
  { name: 'pending-open-focus', file: 'src/native/navigation/open.rs', before: 'if !window.get_search_open() {', after: 'if true {', occurrence: 1, native: true, test: 'pending_file_open_does_not_steal_search_input_focus', failure: 'asynchronous source install stole query focus' },
  { name: 'same-file-focus', file: 'src/native/navigation/open.rs', before: 'if !window.get_search_open() {', after: 'if true {', native: true, test: 'pending_file_open_does_not_steal_search_input_focus', failure: 'same-file request stole query focus' },
];
const results = [];
const run = (item, phase) => {
  const command = item.native
    ? ['cargo', 'nextest', 'run', '--offline', '--features', 'slint/mcp', '--bin', 'monochromatic-ide', '--filter-expr', 'test(' + item.test + ')']
    : ['cargo', 'test', '--offline', '--no-default-features', ...(item.integration ? ['--test', item.integration] : ['--lib']), item.test, '--', '--nocapture'];
  const result = spawnSync('podman', [
    'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
    '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
    '--volume', source + ':/work', '--volume', cache + ':/work/target', '--volume', 'ide-cargo:/cargo',
    '--workdir', '/work', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'SLINT_EMIT_DEBUG_INFO=1',
    '--env', 'SLINT_BACKEND=headless', '--env', 'SLINT_MCP_PORT=0', '--env', 'HELIX_RUNTIME=/work/target/debug/runtime',
    'localhost/monochromatic/ide', ...command,
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(artifact, item.name + '-' + phase + '.log'), output);
  if (result.error) throw result.error;
  const failedAsExpected = result.status !== 0 && output.includes(item.test) && output.includes(item.failure);
  const passedAsExpected = result.status === 0 && output.includes(item.test) && /1 (?:test|passed)/.test(output);
  const accepted = phase === 'removed' ? failedAsExpected : passedAsExpected;
  results.push({ name: item.name, phase, status: result.status, accepted });
  writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2));
  if (!accepted) throw new Error('Unexpected ' + phase + ' result for ' + item.name + '; inspect ' + artifact);
  console.log(JSON.stringify(results.at(-1)));
};
for (const item of cases) {
  run(item, 'baseline');
  if (item.control) continue;
  const path = join(source, item.file);
  const original = readFileSync(path, 'utf8');
  try {
    const changed = item.alter ? item.alter(original) : replaceOne(original, item.before, item.after, item.occurrence);
    if (changed === original) throw new Error('Mutation did not change ' + item.file);
    writeFileSync(path, changed);
    run(item, 'removed');
  } finally { writeFileSync(path, original); }
  run(item, 'restored');
}
console.log('Search guard controls passed: ' + artifact);

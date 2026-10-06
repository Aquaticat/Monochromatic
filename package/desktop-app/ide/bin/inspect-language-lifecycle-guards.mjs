#!/usr/bin/env node
// Controls for the quiet-lifetime regressions (tests/language/quiet.rs), run in a disposable package copy:
// - the strict acceptance test fails on unmodified sources, with helix-lsp's end-of-stream record;
// - the enforced test fails when a server writes one line to standard error, and when the worker no
//   longer asks servers to shut down or no longer waits for them to end;
// - the kill test fails when the worker thread ends without reaping the server it killed;
// - optionally, with a disposable helix clone: the strict test passes once helix-lsp's standard-error
//   reader treats the end of the stream as its response reader does, and fails again without that change.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
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
// A fresh clone of Helix at the pinned revision; the prototype change is applied to it and reverted.
const helix = process.env.usage_helix ? disposable(process.env.usage_helix, 'Helix clone') : undefined;
// An optional part name reruns only that part: 'sources' (the package's own controls) or 'helix' (the prototype).
const only = process.env.usage_only || undefined;
if (only && !['sources', 'helix'].includes(only)) throw new Error('Unknown part: ' + only);
if (only === 'helix' && !helix) throw new Error('The helix part needs the Helix clone argument');
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
const enforced = 'quiet::clean_lifetime_logs_no_error_besides_the_helix_end_of_stream_record';
const strict = 'quiet::clean_lifetime_logs_no_error_level_record';
const killed = 'lifecycle::server_that_ignores_exit_is_killed_and_reaped_before_the_drop_returns';
const endOfStream = 'helix_lsp::transport: scripted-ls err: <- StreamClosed';
const results = [];
// Run one test in the bounded container and compare the outcome with `expect`: 'pass', or the texts a failure must contain.
const run = (name, test, expect) => {
  const command = ['cargo', 'test', '--offline', '--no-default-features', '--test', 'language', test, '--', '--exact', '--nocapture', '--include-ignored'];
  const result = spawnSync('podman', [
    'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
    '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
    '--volume', source + ':/work', '--volume', cache + ':/work/target', '--volume', cargoHome + ':/cargo',
    ...(helix ? ['--volume', helix + ':/helix'] : []),
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

if (only !== 'helix') {
  // Unmodified sources: the enforced test passes, and the strict test fails with exactly the helix-lsp record.
  run('baseline-enforced', enforced, 'pass');
  run('strict-without-a-fix', strict, ['a clean lifetime logged at ERROR', endOfStream]);
  const cases = [
    // The scripted server reports its own shutdown on standard error, as TypeScript 7's server does after `exit`.
    { name: 'server-stderr-line', file: 'src/bin/ide-scripted-lsp/server.rs', before: '} else if method == "shutdown" {', after: '} else if method == "shutdown" { eprintln!("context canceled");', failure: ['a clean lifetime logged at ERROR', 'scripted-ls err <- \\"context canceled'] },
    // The worker drops its servers without asking them to shut down.
    { name: 'no-shutdown-request', file: 'src/language/worker.rs', before: 'client.force_shutdown();', after: '', failure: ['the server was not asked to shut down'] },
    // The worker asks, then drops the registry without waiting for the processes to end.
    { name: 'no-wait-for-exit', file: 'src/language/worker.rs', before: 'while running > 0 {', after: 'while false {', failure: ['the server was not asked to shut down'] },
    // The worker thread ends right after its runtime, without reaping the server it had to kill.
    { name: 'no-reap-after-kill', test: killed, file: 'src/language/worker.rs', before: 'reap::finish(REAP_GRACE);', after: '', failure: ['a child process was left when the drop returned', "'Z'"] },
  ];
  run('baseline-killed', killed, 'pass');
  for (const item of cases) {
    const test = item.test ?? enforced;
    mutated(join(source, item.file), item.before, item.after, () => run(item.name + '-removed', test, item.failure));
    run(item.name + '-restored', test, 'pass');
  }
}

if (helix && only !== 'sources') {
  // Build against the clone instead of Cargo's checkout of the same revision.
  // The checked-out revision is read from the clone's own files, so no git command runs against a third-party clone.
  const head = readFileSync(join(helix, '.git', 'HEAD'), 'utf8').trim();
  const reference = head.startsWith('ref: ') ? head.slice(5) : undefined;
  const loose = reference ? join(helix, '.git', reference) : undefined;
  const packed = () => readFileSync(join(helix, '.git', 'packed-refs'), 'utf8').split('\n').find(line => line.endsWith(' ' + reference))?.split(' ')[0] ?? '';
  const revision = !reference ? head : (existsSync(loose) ? readFileSync(loose, 'utf8').trim() : packed());
  const manifest = readFileSync(join(source, 'Cargo.toml'), 'utf8');
  if (!manifest.includes('rev = "' + revision + '"')) throw new Error('The Helix clone is at ' + revision + ', not at the revision Cargo.toml pins');
  const crates = ['helix-core', 'helix-loader', 'helix-lsp', 'helix-lsp-types', 'helix-parsec', 'helix-stdx'];
  writeFileSync(join(source, 'Cargo.toml'), manifest + '\n[patch."https://github.com/helix-editor/helix"]\n' + crates.map(name => name + ' = { path = "/helix/' + name + '" }').join('\n') + '\n');
  // Control: the same build path with the clone unmodified still fails, so the path override alone changes nothing.
  run('helix-clone-unmodified', strict, ['a clean lifetime logged at ERROR', endOfStream]);
  // The prototype: the standard-error reader stays silent about the end of the stream, as the response reader already is.
  mutated(join(helix, 'helix-lsp/src/transport.rs'),
    '                Err(err) => {\n                    error!("{} err: <- {err:?}", transport.name);\n                    break;\n                }\n            }\n        }\n    }\n\n    async fn send(',
    '                Err(Error::StreamClosed) => break,\n                Err(err) => {\n                    error!("{} err: <- {err:?}", transport.name);\n                    break;\n                }\n            }\n        }\n    }\n\n    async fn send(',
    () => {
      run('helix-prototype-strict', strict, 'pass');
      run('helix-prototype-enforced', enforced, 'pass');
    });
  run('helix-clone-restored', strict, ['a clean lifetime logged at ERROR', endOfStream]);
}
console.log('Language lifecycle guard controls passed: ' + artifact + ' (' + results.length + ' runs)');

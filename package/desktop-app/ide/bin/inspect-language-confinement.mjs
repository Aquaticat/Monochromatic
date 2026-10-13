#!/usr/bin/env node
// Acceptance tests for language-server write confinement, from
// doc/planning/slint-ide-write-confinement.md ("Acceptance tests the application must carry").
// Every run goes through the application's real start path: ide-language-inspect drives LanguageWorker
// with the production setup (bubblewrap), or with the unconfined setup for the guard control.
// Real servers run only against disposable projects: below the private agent scratch root, which is
// on the same file system as real projects, and below fresh private directories in /tmp and
// $XDG_RUNTIME_DIR (/run/user/<uid>), which the sandbox replaces and the policy binds back read-only.
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const inspect = resolve('target/debug/ide-language-inspect');
const scripted = resolve('target/debug/ide-scripted-lsp');
const probeScript = resolve('bin/language-confinement-probe.cjs');
const store = resolve('../../../node_modules/.pnpm');
const realHome = homedir();
const privateRoot = join(realHome, 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Scratch root must exclude group and other permissions: ' + privateRoot);
const base = realpathSync(mkdtempSync(join(privateRoot, 'ide-language-confinement-')));
const results = join(base, 'results');
mkdirSync(results);
console.log('LANGUAGE_CONFINEMENT_ARTIFACT=' + base);

// region fixtures
const write = (path, text, mode) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, mode ? { mode } : undefined);
};
const victims = root => {
  for (const name of ['victim-append.txt', 'victim-truncate.txt', 'victim-rename.txt', 'victim-steal.txt', 'victim-unlink.txt', 'victim-meta.txt', 'victim-link.txt']) write(join(root, name), 'original ' + name + '\n');
};
const offsetOf = (text, needle, within = 0) => {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error('fixture text lacks ' + needle);
  return [...text.slice(0, index)].length + within;
};
// Rust: a build script and a proc macro that try to write the project, private state, an unrelated directory, and /tmp.
// Private state is the sandbox's XDG_CACHE_HOME, which the confined launch points into the server's state directory.
const rustProbe = String.raw`fn ide_probe(who: &str) {
    use std::io::Write;
    let Ok(report_dir) = std::env::var("XDG_CACHE_HOME") else { return };
    let mut lines = String::new();
    for (label, var) in [("project", "IDE_PROBE_PROJECT"), ("state", "XDG_CACHE_HOME"), ("outside", "IDE_PROBE_OUTSIDE"), ("tmp", "IDE_PROBE_TMP")] {
        let Ok(dir) = std::env::var(var) else { continue };
        let path = format!("{dir}/PROBE_{who}_{label}");
        let outcome = std::fs::OpenOptions::new().create(true).append(true).open(&path).and_then(|mut file| file.write_all(b"x"));
        let text = match outcome { Ok(()) => "ok".to_string(), Err(error) => format!("errno={}", error.raw_os_error().unwrap_or(0)) };
        lines.push_str(&format!("{who}\t{label}\t{text}\t{}\n", std::process::id()));
    }
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(format!("{report_dir}/rust-probe.tsv")) {
        let _ = file.write_all(lines.as_bytes());
    }
}
`;
const rustMain = String.raw`use mac::make_fn;

/// Doubles the input.
fn double(value: u32) -> u32 {
    value * 2
}

include!(concat!(env!("OUT_DIR"), "/generated.rs"));

make_fn!();

fn main() {
    let result = double(GENERATED);
    let other = from_macro();
    println!("{result} {other}");
}
`;
const makeRust = root => {
  write(join(root, 'Cargo.toml'), '[package]\nname = "fixture"\nversion = "0.1.0"\nedition = "2021"\nbuild = "build.rs"\n\n[dependencies]\nmac = { path = "mac" }\n\n[workspace]\nmembers = ["mac"]\n');
  write(join(root, 'mac/Cargo.toml'), '[package]\nname = "mac"\nversion = "0.1.0"\nedition = "2021"\n\n[lib]\nproc-macro = true\n');
  write(join(root, 'probe_shared.rs'), rustProbe);
  write(join(root, 'build.rs'), String.raw`include!("probe_shared.rs");

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    let out_dir = std::env::var("OUT_DIR").unwrap();
    std::fs::write(format!("{out_dir}/generated.rs"), "pub const GENERATED: u32 = 7;\n").unwrap();
    ide_probe("build-script");
    if let (Ok(node), Ok(script)) = (std::env::var("IDE_PROBE_NODE"), std::env::var("IDE_PROBE_SCRIPT")) {
        let status = std::process::Command::new(node).arg(script).arg("build-script-child").status();
        eprintln!("ide_probe: escape probe status {status:?}");
    }
}
`);
  write(join(root, 'mac/src/lib.rs'), String.raw`extern crate proc_macro;
use proc_macro::TokenStream;

include!("../../probe_shared.rs");

#[proc_macro]
pub fn make_fn(_input: TokenStream) -> TokenStream {
    ide_probe("proc-macro");
    "fn from_macro() -> u64 { 42 }".parse().unwrap()
}
`);
  write(join(root, 'src/main.rs'), rustMain);
  write(join(root, 'Cargo.lock'), '# This file is automatically @generated by Cargo.\n# It is not intended for manual editing.\nversion = 4\n\n[[package]]\nname = "fixture"\nversion = "0.1.0"\ndependencies = [\n "mac",\n]\n\n[[package]]\nname = "mac"\nversion = "0.1.0"\n');
  victims(root);
};
const tsIndex = "import { greet } from './util.js';\n\nconst message = greet('world');\nconsole.log(message);\n";
// TypeScript 7: the project-supplied launcher runs the probe first, then the real launcher.
const makeTypeScript = root => {
  write(join(root, 'package.json'), JSON.stringify({ name: 'fixture-ts7', version: '0.1.0', private: true, type: 'module' }, null, 2) + '\n');
  write(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'es2022', module: 'nodenext', moduleResolution: 'nodenext', strict: true, noEmit: true }, include: ['src'] }, null, 2) + '\n');
  write(join(root, 'src/util.ts'), '/** Greets a person by name. */\nexport function greet(name: string): string {\n  return `hello ${name}`;\n}\n');
  write(join(root, 'src/index.ts'), tsIndex);
  // A plain JavaScript file with an untyped bare import invites automatic type acquisition.
  write(join(root, 'src/legacy.js'), "const leftPad = require('left-pad');\nmodule.exports = leftPad('x', 3);\n");
  cpSync(join(store, 'typescript@7.0.2/node_modules/typescript'), join(root, 'node_modules/typescript'), { recursive: true });
  cpSync(join(store, '@typescript+typescript-linux-x64@7.0.2/node_modules/@typescript/typescript-linux-x64'), join(root, 'node_modules/@typescript/typescript-linux-x64'), { recursive: true });
  write(join(root, 'node_modules/typescript/bin/tsc'), [
    '#!/usr/bin/env node',
    'import { createRequire } from "node:module";',
    'if (process.env.IDE_PROBE_SCRIPT) {',
    '  try { await createRequire(import.meta.url)(process.env.IDE_PROBE_SCRIPT).runProbe("ts7-launcher"); }',
    '  catch (error) { process.stderr.write(`probe failed: ${error}\\n`); }',
    '}',
    'await import("../lib/tsc.js");',
    '',
  ].join('\n'), 0o755);
  victims(root);
};
// endregion

// region observation helpers
// Every path with type, size, mode, times, link count, inode, content hash, and link target.
const snapshot = root => {
  const entries = {};
  const walk = directory => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const stat = lstatSync(path, { bigint: true });
      const entry = { mode: Number(stat.mode), size: Number(stat.size), mtime: String(stat.mtimeNs), ctime: String(stat.ctimeNs), nlink: Number(stat.nlink), ino: String(stat.ino) };
      if (stat.isSymbolicLink()) entry.target = readlinkSync(path);
      else if (stat.isFile()) entry.sha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
      entries[path.slice(root.length)] = entry;
      if (stat.isDirectory()) walk(path);
    }
  };
  walk(root);
  return entries;
};
const treeDiff = (before, after) => ({
  added: Object.keys(after).filter(key => !(key in before)),
  removed: Object.keys(before).filter(key => !(key in after)),
  changed: Object.keys(after).filter(key => key in before && JSON.stringify(before[key]) !== JSON.stringify(after[key])),
});
const empty = difference => difference.added.length + difference.removed.length + difference.changed.length === 0;
// Processes carrying the session marker in their environment.
const marked = marker => readdirSync('/proc').filter(name => /^\d+$/.test(name)).filter(pid => {
  try { return readFileSync(join('/proc', pid, 'environ'), 'latin1').includes('IDE_LANGUAGE_SESSION=' + marker); } catch { return false; }
});
const sleep = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const stateRoot = join(base, 'app-cache', 'monochromatic-ide', 'language');
// The private state directory the application derives for one server and project:
// `<state root>/<project name>-<FNV-1a 64 of the project path>/<server>`, computed independently here.
const stateOf = (project, server, root = stateRoot) => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(project)) hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
  const name = basename(project).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 40);
  return join(root, name + '-' + hash.toString(16).padStart(16, '0'), server);
};
const probeDocuments = directory => (existsSync(directory) ? readdirSync(directory) : [])
  .filter(name => name.startsWith('probe-') && name.endsWith('.json')).map(name => JSON.parse(readFileSync(join(directory, name), 'utf8')));
const tomlTable = variables => '{ ' + Object.entries(variables).map(([name, value]) => name + ' = ' + JSON.stringify(value)).join(', ') + ' }';
const credentialNames = Object.keys(process.env).filter(name => /TOKEN|KEY|SECRET|PASSWORD/i.test(name));
const hostNamespaces = Object.fromEntries(['user', 'pid', 'net', 'mnt'].map(kind => [kind, readlinkSync('/proc/self/ns/' + kind)]));
// endregion

// region environment: a disposable home, application state in a disposable cache, the real toolchains read-only.
const home = join(base, 'home');
mkdirSync(join(home, '.cargo'), { recursive: true });
mkdirSync(join(home, '.cache'));
mkdirSync(join(home, '.npm'));
if (existsSync(join(realHome, '.cargo', 'config.toml'))) cpSync(join(realHome, '.cargo', 'config.toml'), join(home, '.cargo', 'config.toml'));
const outside = join(base, 'outside');
mkdirSync(outside);
const environment = {
  ...process.env,
  HOME: home,
  CARGO_HOME: join(home, '.cargo'),
  RUSTUP_HOME: process.env.RUSTUP_HOME ?? join(realHome, '.rustup'),
  XDG_CACHE_HOME: join(base, 'app-cache'),
};
const homeBefore = snapshot(home);
// A loopback listener: reachable without a network namespace, unreachable with one.
const listener = createServer(socket => socket.destroy());
await new Promise(done => listener.listen(0, '127.0.0.1', done));
const port = listener.address().port;
// endregion

const run = (name, plan, options = {}) => {
  const planPath = join(results, name + '.plan.json');
  writeFileSync(planPath, JSON.stringify(plan, null, 2));
  const command = options.wrap ? options.wrap[0] : inspect;
  const args = options.wrap ? [...options.wrap.slice(1), inspect, planPath] : [planPath];
  const result = spawnSync(command, args, { encoding: 'utf8', env: { ...environment, ...(options.env ?? {}) }, maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(results, name + '.events.jsonl'), result.stdout ?? '');
  writeFileSync(join(results, name + '.stderr.txt'), result.stderr ?? '');
  if (result.error) throw result.error;
  const events = (result.stdout ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const steps = events.filter(event => event.step !== undefined);
  const indexOf = label => plan.steps.findIndex(step => step.label === label);
  const replies = label => {
    const index = indexOf(label);
    const end = events.indexOf(steps[index]);
    const start = index === 0 ? 0 : events.indexOf(steps[index - 1]);
    return events.slice(start, end).filter(event => event.reply).map(event => event.reply);
  };
  return {
    status: result.status,
    events,
    result: label => steps[indexOf(label)]?.result ?? {},
    hover: label => replies(label).map(reply => reply.outcome.text ?? '').join('\n'),
    statuses: JSON.stringify(events.filter(event => event.status)),
  };
};
const summary = { base, credentialNamesWithheld: credentialNames.length, cases: [] };
let failed = false;
const record = (name, checks, extra = {}) => {
  summary.cases.push({ name, checks: checks.map(([check, passed]) => ({ check, passed })), ...extra });
  for (const [check, passed] of checks) {
    if (!passed) failed = true;
    console.log((passed ? 'PASS ' : 'FAIL ') + name + ': ' + check);
  }
  writeFileSync(join(results, 'results.json'), JSON.stringify(summary, null, 2));
};
// Labels of probe attempts that must fail inside the sandbox, and those that must succeed there.
const mustFail = label => /^(project|escape|alias|undo|delegate|reach\.unix|reach\.tcp|outside)\./.test(label);
const mustSucceed = label => ['state.create', 'tmp.create', 'devnull.write'].includes(label);
const probeVerdicts = documents => documents.flatMap(document => document.results.map(entry => ({ who: document.who, ...entry })))
  .filter(entry => (mustFail(entry.label) && entry.ok) || (mustSucceed(entry.label) && !entry.ok));
// Project writes must fail because the project is read-only, not for an unrelated reason such as a missing path.
const projectWritesNotReadOnly = documents => documents.flatMap(document => document.results.map(entry => ({ who: document.who, ...entry })))
  .filter(entry => entry.label.startsWith('project.'))
  .filter(entry => entry.code !== 'EROFS' && !/Read-only file system|Errno 30/.test(String(entry.stderr ?? '')));
const allowedMount = (mount, state) => mount === state || mount.startsWith(state + '/') || ['/tmp', '/run', '/proc', '/dev'].includes(mount) || mount.startsWith('/dev/') || mount.startsWith('/proc/');

// Variables every probe needs: targets, the host process, socket, and listener to reach, and the session marker.
// The runtime directory and display are passed explicitly because the confined environment is cleared.
const probeVariables = (project, marker, unconfined) => ({
  IDE_PROBE_PROJECT: project, IDE_PROBE_OUTSIDE: outside, IDE_PROBE_TMP: '/tmp', IDE_PROBE_SCRIPT: probeScript,
  IDE_PROBE_HOST_PID: String(process.pid), IDE_PROBE_TCP_PORT: String(port),
  IDE_PROBE_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR ?? '/run/user/' + process.getuid(),
  ...(process.env.WAYLAND_DISPLAY ? { IDE_PROBE_WAYLAND: process.env.WAYLAND_DISPLAY } : {}),
  // Delegation runs only confined: unconfined, systemd-run would really start a unit in the user's manager.
  ...(unconfined ? {} : { IDE_PROBE_DELEGATE: '1' }),
  IDE_LANGUAGE_SESSION: marker,
});

// region Rust: write denial through rust-analyzer, cargo, the build script, the proc macro, and a Node child.
// `where.parent` places the project (default: the scratch base); `where.cache` is the application's
// XDG_CACHE_HOME for the run, which decides where private state lives.
const rustCase = (name, unconfined, where = {}) => {
  const project = join(where.parent ?? base, name);
  makeRust(project);
  const marker = randomBytes(8).toString('hex');
  const variables = { ...probeVariables(project, marker, unconfined), IDE_PROBE_NODE: process.execPath };
  const before = snapshot(project);
  const outcome = run(name, {
    project, unconfined, extra_languages: '[language-server.rust-analyzer]\nenvironment = ' + tomlTable(variables) + '\n',
    steps: [
      { label: 'open', do: 'open', file: 'src/main.rs' },
      { label: 'ready', do: 'ready', seconds: 180 },
      { label: 'generated', do: 'request', kind: 'hover', at: offsetOf(rustMain, 'double(GENERATED)', 8), until: 'hover', seconds: 180 },
      { label: 'macro', do: 'request', kind: 'hover', at: offsetOf(rustMain, 'from_macro()', 1), until: 'hover', seconds: 120 },
      { label: 'definition', do: 'request', kind: 'definition', at: offsetOf(rustMain, 'double(GENERATED)', 1), until: 'locations', seconds: 60 },
      { label: 'settle', do: 'sleep', milliseconds: 8000 },
      { label: 'close', do: 'close' },
    ],
  }, where.cache ? { env: { XDG_CACHE_HOME: where.cache } } : {});
  sleep(3000);
  return { project, before, after: snapshot(project), outcome, marker };
};
// `stateBase` is the resolved state root the application derives from the run's XDG_CACHE_HOME.
const checkRust = (label, { project, before, after, outcome, marker }, stateBase = stateRoot) => {
  const difference = treeDiff(before, after);
  const state = stateOf(project, 'rust-analyzer', stateBase);
  const probeLines = existsSync(join(state, 'cache', 'rust-probe.tsv'))
    ? readFileSync(join(state, 'cache', 'rust-probe.tsv'), 'utf8').split('\n').filter(Boolean).map(line => line.split('\t')) : [];
  const verdict = (who, target) => probeLines.filter(line => line[0] === who && line[1] === target).map(line => line[2]);
  const documents = probeDocuments(join(state, 'cache'));
  const violations = probeVerdicts(documents);
  const mounts = documents.flatMap(document => document.writableMounts ?? []);
  const leaked = documents.flatMap(document => document.environment.filter(name => credentialNames.includes(name)));
  const notReadOnly = projectWritesNotReadOnly(documents);
  // The probe reports are kept with the results; fixtures below /tmp and /run are removed at the end.
  writeFileSync(join(results, label + '.probes.json'), JSON.stringify({ documents, probeLines }, null, 2));
  record(label, [
    ['inspection exited cleanly', outcome.status === 0],
    ['private state is where the application derives it, outside the project', existsSync(state) && !state.startsWith(project + '/')],
    ['hover on the build-script constant succeeded', outcome.result('generated').matched === true && outcome.hover('generated').includes('GENERATED')],
    ['hover on the proc-macro function succeeded', outcome.result('macro').matched === true && outcome.hover('macro').includes('from_macro')],
    ['definition succeeded', outcome.result('definition').matched === true],
    ['the build script hit error 30 on the project', verdict('build-script', 'project').length > 0 && verdict('build-script', 'project').every(text => text === 'errno=30')],
    ['the build script wrote private state and /tmp', verdict('build-script', 'state').includes('ok') && verdict('build-script', 'tmp').includes('ok')],
    ['the build script could not write an unrelated directory', verdict('build-script', 'outside').length > 0 && !verdict('build-script', 'outside').includes('ok')],
    ['the proc macro hit error 30 on the project', verdict('proc-macro', 'project').length > 0 && verdict('proc-macro', 'project').every(text => text === 'errno=30')],
    ['the proc macro wrote private state', verdict('proc-macro', 'state').includes('ok')],
    ['the Node escape probe ran from the build script', documents.some(document => document.who === 'build-script-child')],
    ['every escape, alias, undo, delegation, and reachability probe failed', documents.length > 0 && violations.length === 0],
    ['every project write failed as a read-only file system', documents.length > 0 && notReadOnly.length === 0],
    ['no credential variable reached the server tree', leaked.length === 0],
    ['only private state, /tmp, and kernel file systems are writable', mounts.length > 0 && mounts.every(mount => allowedMount(mount, state))],
    ['the project tree is identical', empty(difference)],
    ['no process carrying the session marker remains', marked(marker).length === 0],
  ], { project, difference, violations, notReadOnly, mounts: [...new Set(mounts)], probeLines, state });
};
checkRust('rust-confined', rustCase('rust-confined', false));
// endregion

// region TypeScript 7: write denial through the project-supplied launcher, liveness past 10 s, no type acquisition.
const tsCase = (name, unconfined, where = {}) => {
  const project = join(where.parent ?? base, name);
  makeTypeScript(project);
  const marker = randomBytes(8).toString('hex');
  const variables = probeVariables(project, marker, unconfined);
  const before = snapshot(project);
  const outcome = run(name, {
    project, unconfined,
    extra_languages: '[language-server.typescript-native]\ncommand = "node_modules/typescript/bin/tsc"\nenvironment = ' + tomlTable(variables) + '\n',
    steps: [
      { label: 'open', do: 'open', file: 'src/index.ts' },
      { label: 'ready', do: 'ready', seconds: 60 },
      { label: 'hover', do: 'request', kind: 'hover', at: offsetOf(tsIndex, "greet('world')", 1), until: 'hover', seconds: 60 },
      { label: 'wait', do: 'sleep', milliseconds: 11000 },
      { label: 'alive', do: 'request', kind: 'hover', at: offsetOf(tsIndex, "greet('world')", 1), until: 'hover', seconds: 10 },
      { label: 'definition', do: 'request', kind: 'definition', at: offsetOf(tsIndex, "greet('world')", 1), until: 'locations', seconds: 30 },
      { label: 'javascript', do: 'open', file: 'src/legacy.js' },
      { label: 'acquisition', do: 'sleep', milliseconds: 6000 },
      { label: 'close', do: 'close' },
    ],
    // The unconfined control keeps type acquisition on (no override) but offline, as a positive control
    // that shows the acquisition check can see npm activity.
  }, unconfined ? { env: { npm_config_cache: join(base, 'control-npm-cache'), npm_config_offline: 'true' } } : (where.cache ? { env: { XDG_CACHE_HOME: where.cache } } : {}));
  sleep(3000);
  return { project, before, after: snapshot(project), outcome, marker };
};
const checkTs = (label, { project, before, after, outcome, marker }, stateBase = stateRoot) => {
  const difference = treeDiff(before, after);
  const state = stateOf(project, 'typescript-native', stateBase);
  const documents = probeDocuments(join(state, 'cache'));
  const launcher = documents.find(document => document.who === 'ts7-launcher');
  // The allowlist, the redirects, and PWD, which bubblewrap itself sets to the working directory after
  // clearing the environment (measured: `bwrap ... --clearenv -- /usr/bin/env` prints only PWD).
  const allowedNames = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'LC_MESSAGES', 'TZ', 'CARGO_HOME', 'RUSTUP_HOME', 'RUSTUP_TOOLCHAIN', 'XDG_CACHE_HOME', 'npm_config_cache', 'PWD'];
  const unexpectedNames = (launcher?.environment ?? []).filter(name => !allowedNames.includes(name) && !name.startsWith('IDE_PROBE_') && name !== 'IDE_LANGUAGE_SESSION');
  const violations = probeVerdicts(documents);
  const notReadOnly = projectWritesNotReadOnly(documents);
  writeFileSync(join(results, label + '.probes.json'), JSON.stringify({ documents }, null, 2));
  record(label, [
    ['inspection exited cleanly', outcome.status === 0],
    ['hover succeeded', outcome.result('hover').matched === true && outcome.hover('hover').includes('greet')],
    ['the server still answers more than 10 s after initialize', outcome.result('alive').matched === true],
    ['definition succeeded', outcome.result('definition').matched === true],
    ['the project launcher ran its probe inside the sandbox', launcher !== undefined],
    ['the launcher saw only the allowlisted environment', launcher !== undefined && unexpectedNames.length === 0],
    ['every escape, alias, undo, delegation, and reachability probe failed', launcher !== undefined && violations.length === 0],
    ['every project write failed as a read-only file system', launcher !== undefined && notReadOnly.length === 0],
    ['only private state, /tmp, and kernel file systems are writable', (launcher?.writableMounts ?? []).length > 0 && launcher.writableMounts.every(mount => allowedMount(mount, state))],
    ['automatic type acquisition wrote nothing', existsSync(state) && !existsSync(join(state, 'cache', 'typescript')) && readdirSync(join(state, 'npm-cache')).length === 0],
    ['the project tree is identical', empty(difference)],
    ['no process carrying the session marker remains', marked(marker).length === 0],
  ], { project, difference, violations, notReadOnly, unexpectedNames, launcherEnvironment: launcher?.environment, mounts: launcher?.writableMounts, signalToHost: launcher?.results.find(entry => entry.label === 'reach.signal0-host-pid'), state });
};
checkTs('ts7-confined', tsCase('ts7-confined', false));
// endregion

// region projects below /tmp and /run: the sandbox replaces both, and the project is bound back read-only.
// Private state lives on the same file system as each project, so hard-link and rename probes are meaningful;
// for /tmp the cache variable reaches it through a symbolic link, which the application resolves first.
const replacedParents = [];
// The literal /tmp, not os.tmpdir(), which follows TMPDIR and could point elsewhere.
for (const [location, directory] of [['tmp', '/tmp'], ['run', process.env.XDG_RUNTIME_DIR ?? '/run/user/' + process.getuid()]]) {
  const parent = realpathSync(mkdtempSync(join(directory, 'ide-language-confinement-')));
  replacedParents.push(parent);
  const resolvedCache = join(parent, 'app-cache');
  mkdirSync(resolvedCache);
  let cache = resolvedCache;
  if (location === 'tmp') {
    cache = join(base, 'cache-link-to-tmp');
    symlinkSync(resolvedCache, cache);
  }
  const where = { parent, cache };
  const stateBase = join(resolvedCache, 'monochromatic-ide', 'language');
  checkRust('rust-below-' + location, rustCase('rust-below-' + location, false, where), stateBase);
  checkTs('ts7-below-' + location, tsCase('ts7-below-' + location, false, where), stateBase);
}
// endregion

// region the scripted server: sandbox audit through the real start path, then the fail-closed cases.
const scriptedProject = join(base, 'scripted-project');
mkdirSync(scriptedProject);
write(join(scriptedProject, 'file.scripted'), 'alpha beta\n');
write(join(scriptedProject, 'victim.txt'), 'original\n');
const scriptedMarker = randomBytes(8).toString('hex');
const scriptedState = stateOf(scriptedProject, 'scripted-ls');
// Write attempts from inside: the project, private /tmp, private state, and an unrelated directory.
const auditTargets = [join(scriptedProject, 'victim.txt'), '/tmp/audit-write', join(scriptedState, 'cache', 'audit-write'), join(outside, 'scripted-audit')];
const scriptedLanguagesWith = targets => [
  '[language-server.scripted-ls]',
  'command = ' + JSON.stringify(scripted),
  'timeout = 5',
  'environment = ' + tomlTable({ IDE_SCRIPTED_REPORT: '/tmp/scripted-report.jsonl', IDE_SCRIPTED_AUDIT: targets.join(':'), IDE_LANGUAGE_SESSION: scriptedMarker }),
  '',
  '[[language]]',
  'name = "scripted"',
  'scope = "source.scripted"',
  'file-types = ["scripted"]',
  'roots = []',
  'language-servers = ["scripted-ls"]',
  '',
].join('\n');
const scriptedPlanFor = (project, targets = auditTargets) => ({ project, extra_languages: scriptedLanguagesWith(targets), steps: [
  { label: 'open', do: 'open', file: 'file.scripted' },
  { label: 'ready', do: 'ready', seconds: 20 },
  { label: 'hover', do: 'request', kind: 'hover', at: 1, until: 'hover', seconds: 10 },
  { label: 'close', do: 'close' },
] });
const scriptedPlan = scriptedPlanFor(scriptedProject);
{
  const before = snapshot(scriptedProject);
  const outcome = run('scripted-confined', scriptedPlan);
  sleep(1000);
  const state = scriptedState;
  const lines = existsSync(join(state, 'tmp', 'scripted-report.jsonl'))
    ? readFileSync(join(state, 'tmp', 'scripted-report.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  const audit = lines.find(line => line.audit)?.audit;
  const writes = Object.fromEntries((audit?.writes ?? []).map(entry => [entry.path, entry]));
  record('scripted-confined', [
    ['the scripted server answered through the sandbox', outcome.result('hover').matched === true],
    ['the server ran in its own user, pid, network, and mount namespaces', audit !== undefined && ['user', 'pid', 'net', 'mnt'].every(kind => audit.namespaces[kind] !== hostNamespaces[kind])],
    ['the project file write failed with error 30', writes[auditTargets[0]]?.errno === 30],
    ['private /tmp and private state were writable', writes[auditTargets[1]]?.ok === true && writes[auditTargets[2]]?.ok === true],
    ['an unrelated directory was not writable', writes[auditTargets[3]]?.errno === 30],
    ['the private /tmp write landed in state, not the host /tmp', existsSync(join(state, 'tmp', 'audit-write')) && !existsSync('/tmp/audit-write')],
    ['the project tree is identical', empty(treeDiff(before, snapshot(scriptedProject)))],
    ['only private state, /tmp, and kernel file systems are writable', (audit?.writableMounts ?? []).length > 0 && audit.writableMounts.every(mount => allowedMount(mount, state))],
    ['no credential variable reached the server', audit !== undefined && !audit.environment.some(name => credentialNames.includes(name))],
    ['no process carrying the session marker remains', marked(scriptedMarker).length === 0],
  ], { audit, state });
}
{
  // Fail closed: private state cannot be created because the cache directory is a regular file.
  const blocked = join(base, 'blocked-cache');
  writeFileSync(blocked, 'not a directory\n');
  const outcome = run('fail-closed-state', scriptedPlan, { env: { XDG_CACHE_HOME: blocked } });
  record('fail-closed-state', [
    ['the server was refused with the cause and remedy', outcome.statuses.includes('LaunchRefused') && outcome.statuses.includes('cannot create') && outcome.statuses.includes('restart the application')],
    ['no process carrying the session marker remains', marked(scriptedMarker).length === 0],
  ]);
}
{
  // Fail closed: user namespaces are denied around the whole application.
  const outcome = run('fail-closed-userns', scriptedPlan, {
    wrap: ['/usr/bin/bwrap', '--unshare-user', '--unshare-pid', '--disable-userns', '--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--bind', base, base, '--'],
  });
  record('fail-closed-userns', [
    ['the server was refused with the namespace cause and remedy', outcome.statuses.includes('LaunchRefused') && outcome.statuses.includes('could not create the language-server sandbox') && outcome.statuses.includes('user namespaces')],
    ['no process carrying the session marker remains', marked(scriptedMarker).length === 0],
  ]);
}
{
  // Helix's spelling: with PWD naming a symbolic link below /tmp, Helix roots servers at that spelling,
  // which exists inside only because the project is bound there too.
  const aliasParent = realpathSync(mkdtempSync(join('/tmp', 'ide-language-alias-')));
  replacedParents.push(aliasParent);
  const alias = join(aliasParent, 'project-link');
  symlinkSync(scriptedProject, alias);
  const aliasVictim = join(alias, 'victim.txt');
  const before = snapshot(scriptedProject);
  const outcome = run('scripted-pwd-alias', scriptedPlanFor(scriptedProject, [aliasVictim, ...auditTargets]), { env: { PWD: alias } });
  sleep(1000);
  const lines = existsSync(join(scriptedState, 'tmp', 'scripted-report.jsonl'))
    ? readFileSync(join(scriptedState, 'tmp', 'scripted-report.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  const audit = lines.find(line => line.audit)?.audit;
  const writes = Object.fromEntries((audit?.writes ?? []).map(entry => [entry.path, entry]));
  const initialize = lines.find(line => line.received === 'initialize')?.params;
  record('scripted-pwd-alias', [
    ['the scripted server answered through the sandbox', outcome.result('hover').matched === true],
    ['Helix gave the server its PWD spelling below /tmp as the root', initialize?.rootPath === alias],
    // Error 30, not 2: the spelling exists inside (bound back) and is read-only.
    ['that spelling exists inside and a write through it failed with error 30', writes[aliasVictim]?.errno === 30],
    // bubblewrap clears the environment while parsing options, before it records the working directory,
    // so the server starts in the canonical spelling of the same directory (bubblewrap.c 0.12.0 lines 2476 and 3247).
    ['the server started in the project directory', audit?.cwd === scriptedProject],
    ['the project tree is identical', empty(treeDiff(before, snapshot(scriptedProject)))],
    ['no process carrying the session marker remains', marked(scriptedMarker).length === 0],
  ], { alias, rootPath: initialize?.rootPath, rootUri: initialize?.rootUri, cwd: audit?.cwd, writes: audit?.writes });
}
// endregion

// region the disposable home stays unchanged by the confined sessions.
{
  const difference = treeDiff(homeBefore, snapshot(home));
  record('no-real-state-pollution', [['the disposable home cargo, cache, and npm directories are unchanged', empty(difference)]], { difference });
}
// endregion

// region guard control: the same fixtures without the wrapper must change the project tree.
{
  const homeBeforeControl = snapshot(home);
  const rust = rustCase('rust-unconfined', true);
  const ts = tsCase('ts7-unconfined', true);
  const rustDifference = treeDiff(rust.before, rust.after);
  const tsDifference = treeDiff(ts.before, ts.after);
  const homeDifference = treeDiff(homeBeforeControl, snapshot(home));
  // Unconfined, every probe reports into the harness's cache directory.
  const controlCache = join(base, 'app-cache');
  const documents = probeDocuments(controlCache);
  const entry = (who, label) => documents.find(document => document.who === who)?.results.find(result => result.label === label);
  const cargoConfig = join(home, '.cargo', 'config.toml');
  const buildDirInHome = existsSync(cargoConfig) && readFileSync(cargoConfig, 'utf8').includes('build-dir');
  const controlNpm = join(base, 'control-npm-cache');
  record('guard-control-unconfined', [
    ['without the wrapper the Rust project tree changed', !empty(rustDifference)],
    ['without the wrapper the TypeScript project tree changed', !empty(tsDifference)],
    ['the Node probe can see a project write when one is possible', entry('build-script-child', 'project.create')?.ok === true && entry('ts7-launcher', 'project.create')?.ok === true],
    ['the reachability probe can see the loopback listener when the network is shared', entry('ts7-launcher', 'reach.tcp.loopback-listener')?.ok === true],
    ['the home check can see cargo writing the cargo home', !buildDirInHome || !empty(homeDifference)],
    ['the acquisition check can see type acquisition when it is not switched off', existsSync(join(controlCache, 'typescript')) || (existsSync(controlNpm) && readdirSync(controlNpm).length > 0)],
  ], { rustDifference, tsDifference, homeDifference: { added: homeDifference.added.length, changed: homeDifference.changed.length }, controlProbes: documents.map(document => ({ who: document.who, passed: document.results.filter(result => result.ok).map(result => result.label) })) });
}
// endregion

listener.close();
// Fixtures below /tmp and /run live in memory; the results above hold everything the checks read.
for (const parent of replacedParents) rmSync(parent, { recursive: true });
console.log('Language confinement ' + (failed ? 'FAILED' : 'passed') + ': ' + join(results, 'results.json'));
if (failed) process.exitCode = 1;

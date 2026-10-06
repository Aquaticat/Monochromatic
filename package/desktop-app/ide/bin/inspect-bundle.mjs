#!/usr/bin/env node
// Check one assembled application directory: the `bundle` task's output, or any copy of it.
// The checked directory is only read. The startup checks run copies of it below the private agent scratch root,
// hosted in the repository's nested compositor, on a one-file project whose language configures no server.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const names = ['inventory', 'license-texts', 'grammars-load', 'starts-outside-source-tree', 'missing-runtime-reported'];
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
for (const name of only ?? []) if (!names.includes(name)) throw new Error('Unknown check name ' + name + '; the checks are ' + names.join(', '));
const bundle = realpathSync(resolve(process.env.usage_directory || 'dist/monochromatic-ide'));
const source = realpathSync(process.cwd());
const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Scratch root must exclude group and other permissions: ' + privateRoot);
const artifact = realpathSync(mkdtempSync(join(privateRoot, 'ide-bundle-check-')));
console.log('BUNDLE_CHECK_ARTIFACT=' + artifact);
console.log('BUNDLE_CHECK_DIRECTORY=' + bundle);

const demand = (condition, message) => { if (!condition) throw new Error(message); };
const isFile = path => { try { return lstatSync(path).isFile(); } catch { return false; } };
const isDirectory = path => { try { return lstatSync(path).isDirectory(); } catch { return false; } };
// ELF files start with these four bytes; a truncated or text file does not.
const isElf = path => {
  const descriptor = openSync(path, 'r');
  try {
    const head = Buffer.alloc(4);
    readSync(descriptor, head, 0, 4, 0);
    return head.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  } finally { closeSync(descriptor); }
};
// Every regular file below a directory, as paths relative to it.
const filesBelow = directory => readdirSync(directory, { withFileTypes: true, recursive: true })
  .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(directory.length + 1));
// The grammar library names the manifest lists, validated the way the application reads them.
const listedGrammars = () => {
  const path = join(bundle, 'runtime', 'manifest.json');
  demand(isFile(path), 'runtime/manifest.json is missing');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  demand(Array.isArray(manifest.grammars) && manifest.grammars.length > 0, 'runtime/manifest.json lists no grammar');
  for (const library of manifest.grammars) demand(typeof library === 'string' && /^[A-Za-z0-9_-]+\.so$/.test(library), 'runtime/manifest.json entry is not a grammar library name: ' + library);
  demand(new Set(manifest.grammars).size === manifest.grammars.length, 'runtime/manifest.json lists a grammar twice');
  return { revision: manifest.helixRevision, libraries: manifest.grammars };
};

const checks = {
  // The executable, the manifest, and exactly the grammar libraries the manifest lists.
  inventory: async () => {
    const binary = join(bundle, 'monochromatic-ide');
    demand(isFile(binary), 'monochromatic-ide is missing or not a regular file');
    demand((lstatSync(binary).mode & 0o100) !== 0, 'monochromatic-ide is not executable');
    demand(isElf(binary), 'monochromatic-ide is not an ELF executable');
    const { revision, libraries } = listedGrammars();
    demand(typeof revision === 'string' && /^[0-9a-f]{40}$/.test(revision), 'runtime/manifest.json does not name the Helix revision');
    const directory = join(bundle, 'runtime', 'grammars');
    demand(isDirectory(directory), 'runtime/grammars is missing');
    const missing = libraries.filter(library => !isFile(join(directory, library)));
    demand(missing.length === 0, 'runtime/grammars lacks listed libraries: ' + missing.join(', '));
    const damaged = libraries.filter(library => !isElf(join(directory, library)));
    demand(damaged.length === 0, 'listed grammar libraries are not ELF shared objects: ' + damaged.join(', '));
    const unlisted = readdirSync(directory).filter(name => !libraries.includes(name));
    demand(unlisted.length === 0, 'runtime/grammars holds entries the manifest does not list: ' + unlisted.join(', '));
    const queries = join(bundle, 'runtime', 'queries');
    demand(isDirectory(queries), 'runtime/queries is missing');
    const highlightRules = filesBelow(queries).filter(file => file.endsWith(sep + 'highlights.scm')).length;
    demand(highlightRules > 0, 'runtime/queries holds no highlights.scm');
    return { helixRevision: revision, grammars: libraries.length, highlightRules };
  },
  // The application's licenses, the font notices, Helix's license, and one notice per grammar.
  'license-texts': async () => {
    const expected = [
      ['LICENSES/LGPL-3.0-or-later.txt', 'GNU LESSER GENERAL PUBLIC LICENSE'],
      ['LICENSES/GPL-3.0-or-later.txt', 'GNU GENERAL PUBLIC LICENSE'],
      ['LICENSES/font/Inter-LICENSE.txt', 'SIL OPEN FONT LICENSE'],
      ['LICENSES/font/JetBrainsMono-OFL.txt', 'SIL OPEN FONT LICENSE'],
      ['runtime/Helix-LICENSE', 'Mozilla Public License Version 2.0'],
    ];
    for (const [relative, phrase] of expected) {
      const path = join(bundle, relative);
      demand(isFile(path), relative + ' is missing');
      demand(readFileSync(path, 'utf8').includes(phrase), relative + ' does not contain "' + phrase + '"');
    }
    for (const relative of ['LICENSES/font/Inter-LICENSE.txt', 'LICENSES/font/JetBrainsMono-OFL.txt']) {
      demand(/^Copyright .*Project Authors/m.test(readFileSync(join(bundle, relative), 'utf8')), relative + ' lacks its copyright line');
    }
    const { libraries } = listedGrammars();
    for (const library of libraries) {
      const name = library.slice(0, -3);
      const directory = join(bundle, 'runtime', 'licenses', name);
      demand(isDirectory(directory), 'runtime/licenses/' + name + ' is missing');
      const notices = filesBelow(directory).filter(file => statSync(join(directory, file)).size > 0);
      demand(notices.length > 0, 'runtime/licenses/' + name + ' holds no notice');
      demand(notices.some(file => /copyright/i.test(readFileSync(join(directory, file), 'utf8'))), 'runtime/licenses/' + name + ' holds no copyright notice');
      // A REUSE-layout source keeps its copyright line only in source headers, which the runtime task extracts.
      if (isDirectory(join(directory, 'LICENSES'))) {
        const headers = join(directory, 'REUSE-headers.txt');
        demand(isFile(headers) && /Copyright/.test(readFileSync(headers, 'utf8')), 'runtime/licenses/' + name + ' ships license texts without REUSE-headers.txt copyright lines');
      }
    }
    return { texts: expected.length, grammarNotices: libraries.length };
  },
  // The package's syntax tests load every listed library and compile every language's rules.
  // HELIX_RUNTIME points them at the checked directory, mounted read-only, instead of the build directory.
  'grammars-load': async () => {
    demand(existsSync('tests/syntax_provisioning.rs'), 'run this check from the package directory: the syntax tests are its probe');
    const result = spawnSync('podman', [
      'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
      '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
      '--volume', source + ':/work', '--volume', 'ide-cargo:/cargo', '--volume', bundle + ':/bundle:ro',
      '--workdir', '/work', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'SLINT_EMIT_DEBUG_INFO=1',
      '--env', 'HELIX_RUNTIME=/bundle/runtime',
      'localhost/monochromatic/ide',
      'cargo', 'test', '--offline', '--no-default-features', '--no-fail-fast',
      '--test', 'syntax', '--test', 'syntax_provisioning', '--test', 'syntax_inventory', '--test', 'syntax_injection',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    writeFileSync(join(artifact, 'grammars-load.log'), output);
    if (result.error) throw result.error;
    const totals = [...output.matchAll(/^test result: (\w+)\. (\d+) passed; (\d+) failed/gm)];
    const passed = totals.reduce((sum, match) => sum + Number(match[2]), 0);
    const failed = totals.reduce((sum, match) => sum + Number(match[3]), 0);
    const failures = [...output.matchAll(/^test (\S+) \.\.\. FAILED$/gm)].map(match => match[1]);
    demand(result.status === 0 && failed === 0, 'syntax tests failed against this directory (exit ' + result.status + '): ' + (failures.join(', ') || 'see grammars-load.log'));
    for (const test of ['bundled_manifest_matches_shipped_libraries_and_notices', 'every_language_on_a_bundled_grammar_compiles_its_highlighting_rules']) {
      demand(output.includes('test ' + test + ' ... ok'), 'the syntax tests did not run ' + test);
    }
    demand(totals.length === 4, 'expected four syntax test binaries, saw ' + totals.length);
    return { testBinaries: totals.length, passed, failed };
  },
};

// One nested-compositor session of an application copy on the disposable project.
// Returns the combined compositor and application output once `settled` accepts it, a screenshot, and what was
// wrong with the way the session ended, if anything: the caller judges the output first, so a damaged directory
// is reported by its damage and not by a slow exit.
const compositor = resolve('../../cli/nested-wayland-session/target/release/monochromatic-nested-wayland-session');
const plain = text => text.replace(/\u001b\[[0-9;]*m/g, '');
// Stop and remove what a session may leave behind, and return what was found.
// A compositor that ends by a signal leaves its hosted application, its private bus daemon, and that daemon's
// directory, which carries the compositor's process id; a compositor that ends on `quit` leaves none of them.
const sweep = (compositorProcess, executable) => {
  const directory = join(tmpdir(), 'monochromatic-nested-wayland-session-' + compositorProcess + '-0');
  const found = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    // A process may end between the listing and these reads; that is not a leftover.
    let exe;
    let command;
    try {
      exe = readlinkSync('/proc/' + entry + '/exe');
      command = readFileSync('/proc/' + entry + '/cmdline', 'utf8').split('\0');
    } catch { continue; }
    if (exe !== executable && !command.some(part => part.includes(directory + sep))) continue;
    found.push(command.filter(Boolean).join(' ').slice(0, 160));
    try { process.kill(Number(entry), 'SIGKILL'); } catch { continue; }
  }
  if (existsSync(directory)) { found.push(directory); rmSync(directory, { recursive: true, force: true }); }
  return found;
};
const session = async ({ name, application, settled }) => {
  demand(process.env.WAYLAND_DISPLAY, 'a Wayland session is needed to host the nested compositor');
  demand(existsSync(compositor), 'missing ' + compositor + '; build //package/cli/nested-wayland-session first');
  const directory = join(artifact, name);
  const project = join(directory, 'project');
  for (const part of ['config', 'cache', 'data', 'project']) mkdirSync(join(directory, part), { recursive: true });
  // SQL has a bundled grammar and no configured language server, so nothing but the application starts.
  writeFileSync(join(project, 'fixture.sql'), ['-- A comment, a keyword, a string, and a number.', "select 'cat' as name, 42 as answer from pets where name = 'cat';", ''].join('\n'));
  // Nothing may point at the source tree: no runtime variable, no Cargo variable, an empty configuration home.
  const env = { ...process.env, XDG_CONFIG_HOME: join(directory, 'config'), XDG_CACHE_HOME: join(directory, 'cache'), XDG_DATA_HOME: join(directory, 'data') };
  for (const key of ['HELIX_RUNTIME', 'CARGO_MANIFEST_DIR', 'SLINT_BACKEND', 'SLINT_MCP_PORT', 'SLINT_SCALE_FACTOR']) delete env[key];
  const socket = join(directory, 'control.sock');
  const child = spawn(compositor, ['--socket', socket, '--size', '1100x660', '--color-scheme', 'dark', '--', join(application, 'monochromatic-ide'), project, '--file', 'fixture.sql'], { cwd: '/', env, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stderr.on('data', chunk => chunks.push(chunk));
  const output = () => plain(Buffer.concat(chunks).toString());
  const exited = once(child, 'exit');
  const control = line => new Promise((resolveReply, reject) => {
    const connection = createConnection(socket);
    let reply = '';
    connection.on('error', reject);
    connection.on('data', chunk => { reply += chunk; if (reply.includes('\n')) { connection.end(); resolveReply(reply.trim()); } });
    connection.write(line + '\n');
  });
  const log = join(directory, 'session.log');
  try {
    const deadline = performance.now() + 30000;
    while (!settled(output())) {
      demand(child.exitCode === null && child.signalCode === null, 'the session ended early with status ' + child.exitCode + '; see ' + log);
      demand(performance.now() < deadline, 'the expected application output did not appear within 30 s; see ' + log);
      await wait(100);
    }
    // A frame counts once two screenshots 250 ms apart are identical.
    const frame = join(directory, 'frame.png');
    let previous;
    for (let attempt = 0; attempt < 20; attempt++) {
      demand(await control('screenshot ' + frame) === 'ok', 'the compositor refused a screenshot');
      const bytes = readFileSync(frame);
      if (previous?.equals(bytes)) break;
      previous = bytes;
      await wait(250);
    }
    demand(await control('quit') === 'ok', 'the compositor refused quit');
    const [code, signal] = await exited;
    let ending;
    // The compositor reports a client it had to kill as exit status 0, so the forced case is checked first.
    if (output().includes('forcing shutdown')) ending = 'the application did not exit within the compositor\'s 2 s after the close request and was stopped by force; see ' + log;
    else if (code !== 0 || signal !== null) ending = 'the session ended with status ' + code + ' and signal ' + signal + '; see ' + log;
    else if (!output().includes('hosted client exited with code 0')) ending = 'the application did not exit with status 0; see ' + log;
    // The application's process may outlive the compositor's report by a moment; a real leftover outlives this wait.
    await wait(300);
    const left = sweep(child.pid, join(application, 'monochromatic-ide'));
    if (ending === undefined && left.length > 0) ending = 'the session left behind: ' + left.join('; ') + '; see ' + log;
    return { output: output(), frame, ending };
  } finally {
    // A failed session is asked to quit first and stopped by a signal only when that does not end it.
    if (child.exitCode === null && child.signalCode === null) {
      const asked = await Promise.race([control('quit').catch(() => undefined), wait(2000)]);
      const force = setTimeout(() => child.kill('SIGKILL'), asked === 'ok' ? 5000 : 0);
      await exited;
      clearTimeout(force);
    }
    writeFileSync(log, output());
    const left = sweep(child.pid, join(application, 'monochromatic-ide'));
    if (left.length > 0) console.error('Removed what the session left behind: ' + left.join('; '));
  }
};
// A copy below the scratch root, optionally without one top-level entry.
const copyOf = (name, omit) => {
  const destination = join(artifact, name);
  const omitted = omit === undefined ? undefined : join(bundle, omit);
  cpSync(bundle, destination, { recursive: true, filter: path => path !== omitted });
  demand(!destination.startsWith(source + sep), 'the application copy must lie outside the source tree');
  return destination;
};
const prepared = /source syntax prepared path=\S*fixture\.sql spans=(\d+)/;
const unavailable = 'highlighting unavailable; retaining readable source';

// The copy runs with no environment at all for --version, then draws highlighted source from its own runtime.
checks['starts-outside-source-tree'] = async () => {
  const application = copyOf('application');
  const version = spawnSync(join(application, 'monochromatic-ide'), ['--version'], { cwd: '/', env: {}, encoding: 'utf8' });
  demand(version.status === 0 && /^monochromatic-ide \d+\.\d+\.\d+/.test(version.stdout), 'the copy did not report its version: ' + JSON.stringify([version.status, version.stdout, version.stderr]));
  const { output, frame, ending } = await session({ name: 'with-runtime', application, settled: text => prepared.test(text) || text.includes(unavailable) });
  demand(!output.includes(unavailable), 'the copy could not highlight from its own runtime: ' + output.split('\n').find(line => line.includes(unavailable)));
  const spans = Number(output.match(prepared)[1]);
  demand(spans > 0, 'the copy prepared no highlighted span for fixture.sql');
  demand(ending === undefined, ending);
  return { version: version.stdout.trim(), spans, frame };
};
// Without its runtime the copy still opens the file, and names the missing manifest instead of showing plain text silently.
checks['missing-runtime-reported'] = async () => {
  const application = copyOf('application-without-runtime', 'runtime');
  demand(!existsSync(join(application, 'runtime')), 'the runtime was not left out of the copy');
  const { output, frame, ending } = await session({ name: 'without-runtime', application, settled: text => prepared.test(text) || text.includes(unavailable) });
  const report = output.split('\n').find(line => line.includes(unavailable));
  demand(report !== undefined, 'the copy without a runtime reported nothing; it would show plain text silently');
  const manifest = join(application, 'runtime', 'manifest.json');
  demand(report.includes('Cannot read the bundled language manifest ' + manifest), 'the report does not name the missing manifest ' + manifest + ': ' + report);
  demand(ending === undefined, ending);
  return { report: report.slice(report.indexOf(unavailable)), frame };
};

const results = [];
for (const name of names) {
  if (only && !only.has(name)) continue;
  try {
    results.push({ name, passed: true, detail: await checks[name]() });
  } catch (error) {
    results.push({ name, passed: false, detail: String(error?.message ?? error) });
  }
  writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.at(-1)));
}
const failed = results.filter(result => !result.passed).map(result => result.name);
if (failed.length > 0) throw new Error('Bundle checks failed for ' + bundle + ': ' + failed.join(', ') + '; inspect ' + artifact);
console.log('Bundle checks passed for ' + bundle + ' (' + results.length + ' of ' + names.length + ' checks): ' + artifact);

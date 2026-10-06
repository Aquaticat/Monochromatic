#!/usr/bin/env node
// Check one single application executable: the `bundle` task's output, or any copy of it.
// The checked file is only read. It is compared with the runtime directory it was built from, and its startup
// checks run copies of it, each alone in a folder below the private agent scratch root, hosted in the repository's
// nested compositor, on a one-file project whose language configures no server.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { inflateSync } from 'node:zlib';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const names = ['inventory', 'license-texts', 'lone-copy-highlights', 'later-start-reuses-cache', 'damaged-cache-rebuilt', 'shadowing-query-ignored', 'concurrent-first-starts', 'damaged-embedded-part-reported', 'old-cache-folders-removed'];
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
for (const name of only ?? []) if (!names.includes(name)) throw new Error('Unknown check name ' + name + '; the checks are ' + names.join(', '));
const executable = realpathSync(resolve(process.env.usage_file || 'dist/monochromatic-ide'));
const runtime = realpathSync(resolve(process.env.usage_runtime || 'target/release/runtime'));
const source = realpathSync(process.cwd());
const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Scratch root must exclude group and other permissions: ' + privateRoot);
const artifact = realpathSync(mkdtempSync(join(privateRoot, 'ide-bundle-check-')));
console.log('BUNDLE_CHECK_ARTIFACT=' + artifact);
console.log('BUNDLE_CHECK_FILE=' + executable);
console.log('BUNDLE_CHECK_RUNTIME=' + runtime);

const demand = (condition, message) => { if (!condition) throw new Error(message); };
const isFile = path => { try { return lstatSync(path).isFile(); } catch { return false; } };
const isDirectory = path => { try { return lstatSync(path).isDirectory(); } catch { return false; } };
// Every regular file below a directory, as paths relative to it, sorted.
const filesBelow = directory => readdirSync(directory, { withFileTypes: true, recursive: true })
  .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(directory.length + 1)).sort();
// The grammar library names the manifest lists, validated the way the build script reads them.
const listedGrammars = () => {
  const manifest = JSON.parse(readFileSync(join(runtime, 'manifest.json'), 'utf8'));
  demand(Array.isArray(manifest.grammars) && manifest.grammars.length > 0, 'runtime/manifest.json lists no grammar');
  for (const library of manifest.grammars) demand(typeof library === 'string' && /^[A-Za-z0-9_-]+\.so$/.test(library), 'runtime/manifest.json entry is not a grammar library name: ' + library);
  return { revision: manifest.helixRevision, libraries: manifest.grammars };
};
// Every file the build script embeds, as [path in the embedded layout, file on disk]: the same list as build.rs.
const expectedFiles = () => {
  const { libraries } = listedGrammars();
  const files = [['runtime/manifest.json', join(runtime, 'manifest.json')], ['runtime/Helix-LICENSE', join(runtime, 'Helix-LICENSE')]];
  for (const relative of filesBelow(join(runtime, 'queries'))) files.push(['runtime/queries/' + relative, join(runtime, 'queries', relative)]);
  for (const library of libraries) {
    const name = library.slice(0, -3);
    files.push(['runtime/grammars/' + library, join(runtime, 'grammars', library)]);
    for (const relative of filesBelow(join(runtime, 'licenses', name))) files.push(['runtime/licenses/' + name + '/' + relative, join(runtime, 'licenses', name, relative)]);
  }
  for (const relative of filesBelow(join(source, 'LICENSES'))) files.push(['LICENSES/' + relative, join(source, 'LICENSES', relative)]);
  for (const notice of ['Inter-LICENSE.txt', 'JetBrainsMono-OFL.txt']) files.push(['LICENSES/font/' + notice, join(source, 'asset', 'font', notice)]);
  return files;
};
let binaryBytes;
const binary = () => (binaryBytes ??= readFileSync(executable));
// The embedded paths whose bytes do not occur in the executable exactly as in the runtime directory.
const notEmbedded = paths => {
  const expected = new Map(expectedFiles());
  return paths.filter(path => {
    const bytes = readFileSync(expected.get(path));
    return bytes.length > 0 && binary().indexOf(bytes) < 0;
  });
};

const checks = {
  // A regular ELF executable that carries every runtime file and license text byte for byte.
  inventory: async () => {
    demand(isFile(executable), executable + ' is missing or not a regular file');
    demand((lstatSync(executable).mode & 0o100) !== 0, executable + ' is not executable');
    demand(binary().subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), executable + ' is not an ELF executable');
    const { revision, libraries } = listedGrammars();
    demand(typeof revision === 'string' && /^[0-9a-f]{40}$/.test(revision), 'runtime/manifest.json does not name the Helix revision');
    const files = expectedFiles();
    const missing = notEmbedded(files.map(([path]) => path));
    demand(missing.length === 0, 'the executable does not embed ' + missing.length + ' of ' + files.length + ' runtime files byte for byte: ' + missing.slice(0, 8).join(', '));
    const embeddedBytes = files.reduce((sum, [, path]) => sum + statSync(path).size, 0);
    const highlightRules = files.filter(([path]) => path.endsWith('/highlights.scm')).length;
    return { size: statSync(executable).size, embeddedFiles: files.length, embeddedBytes, grammars: libraries.length, highlightRules, helixRevision: revision };
  },
  // The application's licenses, the font notices, Helix's license, and one notice per grammar, each embedded.
  'license-texts': async () => {
    const expected = [
      ['LICENSES/LGPL-3.0-or-later.txt', 'GNU LESSER GENERAL PUBLIC LICENSE'],
      ['LICENSES/GPL-3.0-or-later.txt', 'GNU GENERAL PUBLIC LICENSE'],
      ['LICENSES/font/Inter-LICENSE.txt', 'SIL OPEN FONT LICENSE'],
      ['LICENSES/font/JetBrainsMono-OFL.txt', 'SIL OPEN FONT LICENSE'],
      ['runtime/Helix-LICENSE', 'Mozilla Public License Version 2.0'],
    ];
    const files = new Map(expectedFiles());
    for (const [relative, phrase] of expected) {
      demand(files.has(relative) && isFile(files.get(relative)), relative + ' is missing from the build inputs');
      demand(readFileSync(files.get(relative), 'utf8').includes(phrase), relative + ' does not contain "' + phrase + '"');
    }
    for (const relative of ['LICENSES/font/Inter-LICENSE.txt', 'LICENSES/font/JetBrainsMono-OFL.txt']) {
      demand(/^Copyright .*Project Authors/m.test(readFileSync(files.get(relative), 'utf8')), relative + ' lacks its copyright line');
    }
    const { libraries } = listedGrammars();
    const notices = [];
    for (const library of libraries) {
      const name = library.slice(0, -3);
      const directory = join(runtime, 'licenses', name);
      demand(isDirectory(directory), 'runtime/licenses/' + name + ' is missing');
      const texts = filesBelow(directory).filter(file => statSync(join(directory, file)).size > 0);
      demand(texts.length > 0, 'runtime/licenses/' + name + ' holds no notice');
      demand(texts.some(file => /copyright/i.test(readFileSync(join(directory, file), 'utf8'))), 'runtime/licenses/' + name + ' holds no copyright notice');
      // A REUSE-layout source keeps its copyright line only in source headers, which the runtime task extracts.
      if (isDirectory(join(directory, 'LICENSES'))) {
        const headers = join(directory, 'REUSE-headers.txt');
        demand(isFile(headers) && /Copyright/.test(readFileSync(headers, 'utf8')), 'runtime/licenses/' + name + ' ships license texts without REUSE-headers.txt copyright lines');
      }
      notices.push(...texts.map(file => 'runtime/licenses/' + name + '/' + file));
    }
    // `--licenses` with an empty environment (no display, no home) prints every license and notice text in full:
    // the files below LICENSES/ and runtime/licenses/, and every other embedded file named like a license.
    const licenseNamed = relative => {
      const name = relative.split('/').at(-1).toUpperCase();
      return name.includes('LICENSE') || name.includes('LICENCE') || name.startsWith('COPYING') || name.startsWith('NOTICE');
    };
    const listed = expectedFiles().filter(([relative]) => relative.startsWith('LICENSES/') || relative.startsWith('runtime/licenses/') || licenseNamed(relative));
    const listing = spawnSync(executable, ['--licenses'], { env: {}, cwd: artifact, maxBuffer: 64 * 1024 * 1024, timeout: 60_000 });
    demand(!listing.error, 'could not run ' + executable + ' --licenses: ' + listing.error?.message);
    demand(listing.status === 0, executable + ' --licenses exited with status ' + listing.status + ': ' + listing.stderr.toString('utf8').slice(0, 600));
    demand(listing.stderr.length === 0, executable + ' --licenses wrote to standard error: ' + listing.stderr.toString('utf8').slice(0, 600));
    const printed = listing.stdout.toString('utf8');
    const headings = printed.split('\n').filter(line => line.startsWith('Embedded as ')).length;
    demand(headings === listed.length, '--licenses printed ' + headings + ' texts, expected ' + listed.length);
    const rule = '='.repeat(78);
    const unprinted = listed.filter(([relative, file]) => !printed.includes('\nEmbedded as ' + relative + '\n' + rule + '\n\n' + readFileSync(file, 'utf8')));
    demand(unprinted.length === 0, '--licenses does not print in full: ' + unprinted.map(([relative]) => relative).join(', '));
    const missing = notEmbedded([...expected.map(([relative]) => relative), ...notices]);
    demand(missing.length === 0, 'license texts not embedded byte for byte: ' + missing.join(', '));
    return { texts: expected.length, grammarNotices: notices.length, listedByLicensesFlag: headings, listingBytes: listing.stdout.length };
  },
};

// One nested-compositor session of an application copy on the disposable project.
// Returns the combined compositor and application output once `settled` accepts it, a screenshot, the time from
// start to the settled output, and what was wrong with the way the session ended, if anything: the caller judges
// the output first, so a damaged file is reported by its damage and not by a slow exit.
const compositor = resolve('../../cli/nested-wayland-session/target/release/monochromatic-nested-wayland-session');
const plain = text => text.replace(/\u001b\[[0-9;]*m/g, '');
// Distinct colors among every 61st pixel of the compositor's RGBA PNG: a window not yet drawn is one flat color.
const sampledColors = png => {
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('latin1', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const width = png.readUInt32BE(16);
  const rows = inflateSync(Buffer.concat(chunks));
  const stride = 1 + width * 4;
  const colors = new Set();
  for (let row = 0; row * stride < rows.length; row++) {
    for (let column = row % 61; column < width; column += 61) colors.add(rows.readUInt32BE(row * stride + 1 + column * 4));
  }
  return colors.size;
};
// Stop and remove what a session may leave behind, and return what was found.
// A compositor that ends by a signal leaves its hosted application, its private bus daemon, and that daemon's
// directory, which carries the compositor's process id; a compositor that ends on `quit` leaves none of them.
const sweep = (compositorProcess, application) => {
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
    if (exe !== application && !command.some(part => part.includes(directory + sep))) continue;
    found.push(command.filter(Boolean).join(' ').slice(0, 160));
    try { process.kill(Number(entry), 'SIGKILL'); } catch { continue; }
  }
  if (existsSync(directory)) { found.push(directory); rmSync(directory, { recursive: true, force: true }); }
  return found;
};
const prepared = /source syntax prepared path=\S*fixture\.sql spans=(\d+)/;
const unavailable = 'highlighting unavailable; retaining readable source';
const settledOnSyntax = text => prepared.test(text) || text.includes(unavailable);
// `cache` and `config` may be shared between sessions; each session gets its own project and data folders.
const session = async ({ name, application, cache, config, settled = settledOnSyntax }) => {
  demand(process.env.WAYLAND_DISPLAY, 'a Wayland session is needed to host the nested compositor');
  demand(existsSync(compositor), 'missing ' + compositor + '; build //package/cli/nested-wayland-session first');
  const directory = join(artifact, name);
  const project = join(directory, 'project');
  for (const part of ['data', 'project']) mkdirSync(join(directory, part), { recursive: true });
  mkdirSync(cache, { recursive: true });
  mkdirSync(config, { recursive: true });
  // SQL has a bundled grammar and no configured language server, so nothing but the application starts.
  writeFileSync(join(project, 'fixture.sql'), ['-- A comment, a keyword, a string, and a number.', "select 'cat' as name, 42 as answer from pets where name = 'cat';", ''].join('\n'));
  // Nothing may point at the source tree: no runtime variable, no Cargo variable, private XDG homes.
  const env = { ...process.env, XDG_CONFIG_HOME: config, XDG_CACHE_HOME: cache, XDG_DATA_HOME: join(directory, 'data') };
  for (const key of ['HELIX_RUNTIME', 'CARGO_MANIFEST_DIR', 'SLINT_BACKEND', 'SLINT_MCP_PORT', 'SLINT_SCALE_FACTOR', 'RUST_LOG']) delete env[key];
  const socket = join(directory, 'control.sock');
  const started = performance.now();
  // RUST_LOG asks the application for the debug records these checks read (a build whose default level is lower
  // shows them only through it); it is set for the application alone, because the compositor reads it too.
  const hosted = ['/usr/bin/env', 'RUST_LOG=ide_app=debug,monochromatic_ide=debug', application, project, '--file', 'fixture.sql'];
  const child = spawn(compositor, ['--socket', socket, '--size', '1100x660', '--color-scheme', 'dark', '--', ...hosted], { cwd: '/', env, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stderr.on('data', chunk => chunks.push(chunk));
  const output = () => plain(Buffer.concat(chunks).toString());
  const exited = once(child, 'exit');
  const control = line => new Promise((resolveReply, reject) => {
    const connection = createConnection(socket);
    let reply = '';
    connection.on('error', reject);
    // A compositor that is going away may close the connection without a reply; that must not hang the check.
    connection.on('close', () => reject(new Error('the compositor closed the control connection without replying to ' + line)));
    connection.on('data', chunk => { reply += chunk; if (reply.includes('\n')) { connection.end(); resolveReply(reply.trim()); } });
    connection.write(line + '\n');
  });
  const log = join(directory, 'session.log');
  try {
    // The compositor's own start (its EGL setup) took 37 s at a host load of 77 on 2026-10-06, and it starts the
    // application only after that; the application's 60 s count from the compositor's first control reply.
    const compositorDeadline = performance.now() + 120000;
    while (!(await control('ping').then(reply => reply.startsWith('ok'), () => false))) {
      demand(child.exitCode === null && child.signalCode === null, 'the session ended early with status ' + child.exitCode + '; see ' + log);
      demand(performance.now() < compositorDeadline, 'the compositor did not answer its control socket within 120 s; see ' + log);
      await wait(100);
    }
    const deadline = performance.now() + 60000;
    while (!settled(output())) {
      demand(child.exitCode === null && child.signalCode === null, 'the session ended early with status ' + child.exitCode + '; see ' + log);
      demand(performance.now() < deadline, 'the expected application output did not appear within 60 s of the compositor answering; see ' + log);
      await wait(50);
    }
    const settledAfter = Math.round(performance.now() - started);
    // A frame counts once the window is drawn (more than eight sampled colors) and two screenshots 250 ms apart
    // are identical. The rows are filtered per line, but these screenshots use no filter, so pixels read directly.
    const frame = join(directory, 'frame.png');
    let previous;
    let colors = 0;
    for (let attempt = 0; attempt < 240; attempt++) {
      demand(await control('screenshot ' + frame) === 'ok', 'the compositor refused a screenshot');
      const bytes = readFileSync(frame);
      colors = sampledColors(bytes);
      if (colors > 8 && previous?.equals(bytes)) break;
      previous = bytes;
      await wait(250);
    }
    demand(colors > 8, 'the window was not drawn within 60 s of the settled output; see ' + frame);
    demand(await control('quit') === 'ok', 'the compositor refused quit');
    const [code, signal] = await exited;
    let ending;
    // The compositor reports a client it had to kill as exit status 0, so the forced case is checked first.
    if (output().includes('forcing shutdown')) ending = 'the application did not exit within the compositor\'s 2 s after the close request and was stopped by force; see ' + log;
    else if (code !== 0 || signal !== null) ending = 'the session ended with status ' + code + ' and signal ' + signal + '; see ' + log;
    else if (!output().includes('hosted client exited with code 0')) ending = 'the application did not exit with status 0; see ' + log;
    // The application's process may outlive the compositor's report by a moment; a real leftover outlives this wait.
    await wait(300);
    const left = sweep(child.pid, application);
    if (ending === undefined && left.length > 0) ending = 'the session left behind: ' + left.join('; ') + '; see ' + log;
    return { output: output(), frame, settledAfter, ending };
  } finally {
    // A failed session is asked to quit first and stopped by a signal only when that does not end it.
    if (child.exitCode === null && child.signalCode === null) {
      const asked = await Promise.race([control('quit').catch(() => undefined), wait(2000)]);
      const force = setTimeout(() => child.kill('SIGKILL'), asked === 'ok' ? 5000 : 0);
      await exited;
      clearTimeout(force);
    }
    writeFileSync(log, output());
    const left = sweep(child.pid, application);
    if (left.length > 0) console.error('Removed what the session left behind: ' + left.join('; '));
  }
};
// A copy of the executable alone in its own folder below the scratch root, so nothing can lie beside it.
const loneCopy = name => {
  const directory = join(artifact, name);
  mkdirSync(directory);
  const copy = join(directory, 'monochromatic-ide');
  copyFileSync(executable, copy);
  chmodSync(copy, 0o755);
  demand(!copy.startsWith(source + sep), 'the application copy must lie outside the source tree');
  demand(readdirSync(directory).length === 1, 'the copy is not alone in its folder');
  return copy;
};
const spansOf = (output, what) => {
  demand(!output.includes(unavailable), what + ' could not highlight: ' + output.split('\n').find(line => line.includes(unavailable)));
  const spans = Number(output.match(prepared)[1]);
  demand(spans > 0, what + ' prepared no highlighted span for fixture.sql');
  return spans;
};
// The one cache folder of this executable's embedded runtime, below a cache home.
const keyFolder = cache => {
  const root = join(cache, 'monochromatic-ide', 'runtime');
  demand(isDirectory(root), 'no unpacked runtime below ' + root);
  const keys = readdirSync(root);
  demand(keys.length === 1 && /^[0-9a-f]{16}$/.test(keys[0]), 'expected one runtime key folder below ' + root + ', found ' + JSON.stringify(keys));
  return join(root, keys[0]);
};
const cachedSql = cache => join(keyFolder(cache), 'grammars', 'sql.so');
const sqlLibrary = () => readFileSync(join(runtime, 'grammars', 'sql.so'));
const partials = cache => readdirSync(join(keyFolder(cache), 'grammars')).filter(name => !name.endsWith('.so'));
const elapsed = (output, phrase) => Number(output.split('\n').find(line => line.includes(phrase))?.match(/elapsed_us=(\d+)/)?.[1] ?? NaN);
const unpackedPhrase = 'language parser unpacked into the private cache';
const reusedPhrase = 'cached language parser matches the embedded one';
const rewrittenPhrase = 'cached language parser differs from the embedded one; writing it again';

// A lone copy reports its version with no environment at all, then highlights from what it carries, unpacking only
// the parser it needs into an empty private cache.
checks['lone-copy-highlights'] = async () => {
  const application = loneCopy('lone');
  const version = spawnSync(application, ['--version'], { cwd: '/', env: {}, encoding: 'utf8' });
  demand(version.status === 0 && /^monochromatic-ide \d+\.\d+\.\d+/.test(version.stdout), 'the copy did not report its version: ' + JSON.stringify([version.status, version.stdout, version.stderr]));
  const cache = join(artifact, 'lone-home', 'cache');
  const { output, frame, settledAfter, ending } = await session({ name: 'lone-session', application, cache, config: join(artifact, 'lone-home', 'config') });
  const spans = spansOf(output, 'the lone copy');
  demand(isFile(cachedSql(cache)) && readFileSync(cachedSql(cache)).equals(sqlLibrary()), 'the unpacked sql.so differs from the runtime it was built from');
  demand(partials(cache).length === 0, 'partial files remain in the cache: ' + partials(cache).join(', '));
  demand(output.includes(unpackedPhrase), 'the first start did not report unpacking the parser');
  demand(ending === undefined, ending);
  return { version: version.stdout.trim(), spans, key: keyFolder(cache).split(sep).at(-1), unpackedUs: elapsed(output, unpackedPhrase), settledAfterMs: settledAfter, frame };
};
// A second start with the same cache compares the cached parser and reuses it without writing.
checks['later-start-reuses-cache'] = async () => {
  const application = loneCopy('later');
  const home = join(artifact, 'later-home');
  const cache = join(home, 'cache');
  const first = await session({ name: 'later-first', application, cache, config: join(home, 'config') });
  spansOf(first.output, 'the first start');
  const before = statSync(cachedSql(cache));
  const second = await session({ name: 'later-second', application, cache, config: join(home, 'config') });
  const spans = spansOf(second.output, 'the later start');
  demand(second.output.includes(reusedPhrase), 'the later start did not report reusing the cached parser');
  demand(!second.output.includes(unpackedPhrase), 'the later start unpacked the parser again');
  const after = statSync(cachedSql(cache));
  demand(after.mtimeMs === before.mtimeMs && after.ino === before.ino, 'the later start rewrote the cached parser');
  demand(first.ending === undefined, first.ending);
  demand(second.ending === undefined, second.ending);
  return { spans, firstUnpackedUs: elapsed(first.output, unpackedPhrase), laterReusedUs: elapsed(second.output, reusedPhrase), firstSettledAfterMs: first.settledAfter, laterSettledAfterMs: second.settledAfter, frame: second.frame };
};
// A cached parser with one changed byte is detected, written again from the embedded copy, and highlighting works.
checks['damaged-cache-rebuilt'] = async () => {
  const application = loneCopy('damaged-cache');
  const home = join(artifact, 'damaged-cache-home');
  const cache = join(home, 'cache');
  const first = await session({ name: 'damaged-cache-first', application, cache, config: join(home, 'config') });
  spansOf(first.output, 'the first start');
  const damaged = readFileSync(cachedSql(cache));
  damaged[Math.floor(damaged.length / 2)] ^= 0x01;
  writeFileSync(cachedSql(cache), damaged);
  const second = await session({ name: 'damaged-cache-second', application, cache, config: join(home, 'config') });
  const spans = spansOf(second.output, 'the start after the damage');
  demand(second.output.includes(rewrittenPhrase), 'the damaged cached parser was not reported and written again');
  demand(readFileSync(cachedSql(cache)).equals(sqlLibrary()), 'the cached parser was not restored');
  demand(partials(cache).length === 0, 'partial files remain in the cache: ' + partials(cache).join(', '));
  demand(second.ending === undefined, second.ending);
  return { spans, report: second.output.split('\n').find(line => line.includes(rewrittenPhrase)).slice(0, 300), frame: second.frame };
};
// An empty highlights.scm below $XDG_CONFIG_HOME/helix/runtime, which Helix's own lookup prefers, changes nothing.
checks['shadowing-query-ignored'] = async () => {
  const application = loneCopy('shadowing');
  const home = join(artifact, 'shadowing-home');
  const plainRun = await session({ name: 'shadowing-without', application, cache: join(home, 'cache'), config: join(home, 'config-empty') });
  const without = spansOf(plainRun.output, 'the start without a user query');
  const queries = join(home, 'config-shadowing', 'helix', 'runtime', 'queries', 'sql');
  mkdirSync(queries, { recursive: true });
  writeFileSync(join(queries, 'highlights.scm'), '');
  const shadowed = await session({ name: 'shadowing-with', application, cache: join(home, 'cache'), config: join(home, 'config-shadowing') });
  const withQuery = spansOf(shadowed.output, 'the start with an empty user query');
  demand(withQuery === without, 'the user query changed the highlighting: ' + without + ' spans without it, ' + withQuery + ' with it');
  demand(plainRun.ending === undefined, plainRun.ending);
  demand(shadowed.ending === undefined, shadowed.ending);
  return { spansWithout: without, spansWithShadowingQuery: withQuery, frame: shadowed.frame };
};
// Two first starts at the same moment, sharing one empty cache, both highlight and leave one intact parser.
// Each runs its own identical copy, so the leftover sweep of one session cannot stop the other's application.
checks['concurrent-first-starts'] = async () => {
  const home = join(artifact, 'concurrent-home');
  const cache = join(home, 'cache');
  const [left, right] = await Promise.all(['concurrent-left', 'concurrent-right'].map(name => session({ name, application: loneCopy(name + '-copy'), cache, config: join(home, 'config') })));
  const spans = [spansOf(left.output, 'the first concurrent start'), spansOf(right.output, 'the second concurrent start')];
  demand(readFileSync(cachedSql(cache)).equals(sqlLibrary()), 'the shared cached parser is not intact');
  demand(partials(cache).length === 0, 'partial files remain in the cache: ' + partials(cache).join(', '));
  demand(left.ending === undefined, left.ending);
  demand(right.ending === undefined, right.ending);
  const writers = [left, right].filter(run => run.output.includes(unpackedPhrase)).length;
  return { spans, sessionsThatWrote: writers, frame: left.frame };
};
// One changed byte inside the embedded sql.so: the copy keeps the source readable and names the damaged part and
// the remedy, and unpacks nothing for it.
checks['damaged-embedded-part-reported'] = async () => {
  const application = loneCopy('damaged-embedded');
  const bytes = readFileSync(application);
  const library = sqlLibrary();
  const at = bytes.indexOf(library);
  demand(at >= 0, 'the executable does not embed sql.so; the inventory check names what is missing');
  demand(bytes.indexOf(library, at + 1) < 0, 'sql.so occurs twice in the executable, so the damaged copy would be ambiguous');
  bytes[at + Math.floor(library.length / 2)] ^= 0x01;
  writeFileSync(application, bytes);
  const home = join(artifact, 'damaged-embedded-home');
  const { output, frame, ending } = await session({ name: 'damaged-embedded-session', application, cache: join(home, 'cache'), config: join(home, 'config') });
  const report = output.split('\n').find(line => line.includes(unavailable));
  demand(report !== undefined, 'the damaged copy reported nothing; it would load or silently skip a damaged parser');
  demand(report.includes('runtime/grammars/sql.so embedded in ' + application + ' is damaged'), 'the report does not name the damaged part and the executable: ' + report);
  demand(report.includes('Replace the executable'), 'the report does not give the remedy: ' + report);
  const unpackedRoot = join(home, 'cache', 'monochromatic-ide', 'runtime');
  // Every start renews its key folder's `last-used` marker; anything else below the runtime cache was unpacked.
  const unpacked = isDirectory(unpackedRoot) ? filesBelow(unpackedRoot).filter(file => !/^[0-9a-f]{16}\/last-used$/.test(file)) : [];
  demand(unpacked.length === 0, 'files were unpacked although the embedded part is damaged: ' + unpacked.join(', '));
  demand(ending === undefined, ending);
  return { report: report.slice(report.indexOf(unavailable)).slice(0, 400), frame };
};

// A start removes the cache folders of other builds unused for more than 30 days and the rest of a removal cut
// short, keeps a folder used a day ago, and renews its own folder's marker, all before any window: the display
// connection of this start fails on purpose, so no compositor is needed.
checks['old-cache-folders-removed'] = async () => {
  const base = mkdtempSync(join(artifact, 'old-cache-'));
  const project = join(base, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'fixture.sql'), 'select 1;\n');
  const runtimeCache = join(base, 'cache', 'monochromatic-ide', 'runtime');
  const now = Date.now();
  const seed = (name, daysAgo) => {
    mkdirSync(join(runtimeCache, name, 'grammars'), { recursive: true, mode: 0o700 });
    writeFileSync(join(runtimeCache, name, 'grammars', 'sql.so'), 'an older build');
    writeFileSync(join(runtimeCache, name, 'last-used'), '');
    const time = new Date(now - daysAgo * 86_400_000);
    utimesSync(join(runtimeCache, name, 'last-used'), time, time);
  };
  seed('0000000000000031', 31);
  seed('0000000000000001', 1);
  mkdirSync(join(runtimeCache, '.00000000000000aa.removing-1-0', 'grammars'), { recursive: true });
  const started = spawnSync(executable, [project], {
    cwd: base, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 60_000,
    env: { PATH: '/usr/bin', HOME: join(base, 'home'), XDG_CACHE_HOME: join(base, 'cache'), XDG_CONFIG_HOME: join(base, 'config'), XDG_DATA_HOME: join(base, 'data'), XDG_RUNTIME_DIR: base, WAYLAND_DISPLAY: join(base, 'absent-wayland.socket'), SLINT_BACKEND: 'winit', RUST_LOG: 'ide_app=debug,monochromatic_ide=debug' },
  });
  const output = plain((started.stdout ?? '') + (started.stderr ?? ''));
  writeFileSync(join(base, 'start.log'), output);
  demand(!started.error, 'could not start ' + executable + ': ' + started.error?.message);
  const left = readdirSync(runtimeCache).sort();
  demand(!left.includes('0000000000000031'), 'the folder unused for 31 days remains: ' + JSON.stringify(left));
  demand(!left.some(name => name.startsWith('.')), 'the rest of a cut-short removal remains: ' + JSON.stringify(left));
  demand(isFile(join(runtimeCache, '0000000000000001', 'grammars', 'sql.so')), 'the folder used a day ago was removed: ' + JSON.stringify(left));
  const own = left.filter(name => name !== '0000000000000001');
  demand(own.length === 1 && /^[0-9a-f]{16}$/.test(own[0]), 'expected this build\'s key folder besides the kept one: ' + JSON.stringify(left));
  const renewed = lstatSync(join(runtimeCache, own[0], 'last-used')).mtimeMs;
  demand(renewed >= now - 1000, 'this build\'s marker was not renewed at start');
  return { left, status: started.status, tidyElapsedUs: elapsed(output, 'runtime cache tidied') };
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
if (failed.length > 0) throw new Error('Bundle checks failed for ' + executable + ': ' + failed.join(', ') + '; inspect ' + artifact);
console.log('Bundle checks passed for ' + executable + ' (' + results.length + ' of ' + names.length + ' checks): ' + artifact);

#!/usr/bin/env node
// Check at the user boundary that a reader that stops reading the IDE's log does not freeze the window,
// and observe the defect it replaced as the guard control.
//
// Two builds come from one disposable package copy: the sources as they are, and the same sources with the
// log written synchronously from the logging thread (the writer swapped for plain standard output, where the
// log goes). Each runs in the repository's nested compositor with every record of the application on
// (`RUST_LOG=ide_app=debug,monochromatic_ide=debug`, the fixed level before 2026-10-06); a global `debug`
// also turns on the regex crates' records and made startup take a minute.
// The IDE's standard output goes to a FIFO that this script opens and never reads, so once the kernel's
// pipe buffer is full every write to it blocks. While keys move the caret, the script asks the IDE's Slint
// MCP server, which runs on the window's event loop (`i-slint-backend-testing` 1.18.1, `mcp_server.rs`,
// `spawn_local`), for its window list over and over and records how long each answer takes. A blocked
// event loop answers nothing. After the measurement the FIFO is drained, so the log's gap warning, if any,
// can be read, and the IDE is quit.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, constants, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, rmSync, statfsSync, statSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Scratch root must exclude group and other permissions: ' + privateRoot);
const disposable = (value, what) => {
  const resolved = realpathSync(value);
  if (!resolved.startsWith(realpathSync(privateRoot) + sep) || !statSync(resolved).isDirectory()) throw new Error(what + ' must be a disposable directory below ' + privateRoot);
  return resolved;
};
if (!process.env.usage_cache) throw new Error('Provide the disposable Cargo target-cache directory');
const cache = disposable(process.env.usage_cache, 'Target cache');
const cargoHome = process.env.usage_cargo ? disposable(process.env.usage_cargo, 'Cargo home copy') : 'ide-cargo';
const seconds = Number(process.env.usage_seconds ?? 30);
if (!Number.isInteger(seconds) || seconds < 5) throw new Error('seconds must be a whole number of at least 5');
const port = process.env.usage_port ?? '9408';
const origin = process.cwd();
// Memory-backed storage for the live session files (see `session`).
const TMPFS_MAGIC = 0x01021994;
const liveRoot = process.env.XDG_RUNTIME_DIR;
if (!liveRoot || (statSync(liveRoot).mode & 0o077) !== 0 || statfsSync(liveRoot).type !== TMPFS_MAGIC) throw new Error('XDG_RUNTIME_DIR must name a private memory-backed directory for the live session files');
const compositor = resolve(origin, '../../cli/nested-wayland-session/target/release/monochromatic-nested-wayland-session');
if (!existsSync(compositor)) throw new Error('Build the nested compositor first: ' + compositor);
const artifact = mkdtempSync(join(privateRoot, 'ide-log-stall-'));
const source = join(artifact, 'package');
cpSync(origin, source, { recursive: true, filter: path => !['target', '.git', 'node_modules'].includes(relative(origin, path).split(sep)[0]) });
mkdirSync(join(source, 'target'), { recursive: true });
console.log('LOG_STALL_ARTIFACT=' + artifact + ' load=' + readFileSync('/proc/loadavg', 'utf8').trim());

// region builds
const build = label => {
  const result = spawnSync('podman', [
    'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
    '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
    '--volume', source + ':/work', '--volume', cache + ':/work/target', '--volume', cargoHome + ':/cargo',
    '--workdir', '/work', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'SLINT_EMIT_DEBUG_INFO=1',
    'localhost/monochromatic/ide', 'cargo', 'build', '--offline', '--features', 'slint/mcp', '--bin', 'monochromatic-ide',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(artifact, 'build-' + label + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Build ' + label + ' failed; inspect ' + artifact);
  const binary = join(artifact, 'ide-' + label);
  copyFileSync(join(cache, 'debug', 'monochromatic-ide'), binary);
  return binary;
};
const replaceOne = (text, before, after) => {
  const start = text.indexOf(before);
  if (start < 0) throw new Error('Mutation source anchor is absent: ' + before);
  if (text.indexOf(before, start + before.length) >= 0) throw new Error('Mutation source anchor is ambiguous: ' + before);
  return text.slice(0, start) + after + text.slice(start + before.length);
};
const nativePath = join(source, 'src/native.rs');
const native = readFileSync(nativePath, 'utf8');
const variants = [{ name: 'background-writer', binary: build('background-writer') }];
try {
  writeFileSync(nativePath, replaceOne(native, 'logging::install(logging::filter(""), log_writer, None)?;', 'drop(log_writer);\n    logging::install(logging::filter(""), std::io::stdout, None)?;'));
  variants.push({ name: 'synchronous-writer', binary: build('synchronous-writer') });
} finally { writeFileSync(nativePath, native); }
// endregion

// region session
const project = join(artifact, 'project');
mkdirSync(project);
const file = join(project, 'view.txt');
writeFileSync(file, Array.from({ length: 400 }, (_, index) => 'line ' + index + ' of a file whose caret moves while the log is not read').join('\n') + '\n');
const fontConfig = join(artifact, 'fonts.conf');
writeFileSync(fontConfig, '<fontconfig><dir>/usr/share/fonts</dir><cachedir prefix="xdg">fontconfig</cachedir></fontconfig>');
for (const name of ['config', 'cache', 'data']) mkdirSync(join(artifact, name));
const runtime = [join(origin, 'target/debug/runtime'), join(cache, 'debug/runtime')].find(existsSync);
// The private font cache is built once before the first session; otherwise the first window waits for it
// (38 s once at a load average of 90) and the two variants would start under different conditions.
const fontWarmup = spawnSync('fc-list', [], { env: { ...process.env, FONTCONFIG_FILE: fontConfig, XDG_CACHE_HOME: join(artifact, 'cache') }, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
if (fontWarmup.status !== 0) throw new Error('fc-list failed while building the private font cache: ' + fontWarmup.stderr);
const control = async (socketPath, line) => {
  const socket = createConnection(socketPath);
  await once(socket, 'connect');
  socket.write(line + '\n');
  const [response] = await once(socket, 'data');
  socket.end();
  return String(response).trim();
};
const listening = () => spawnSync('ss', ['--listening', '--tcp', '--numeric'], { encoding: 'utf8' }).stdout.split('\n').some(line => line.includes(':' + port + ' '));
let requestId = 0;
// One MCP tool call with a bound; resolves to the parsed result, or throws on timeout.
const mcp = async (name, args, milliseconds) => {
  const response = await fetch('http://127.0.0.1:' + port + '/mcp', { method: 'POST', signal: AbortSignal.timeout(milliseconds), headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method: 'tools/call', params: { name, arguments: args } }) });
  const data = await response.json();
  if (data.error || data.result.isError) throw new Error(JSON.stringify(data));
  return JSON.parse(data.result.content.find(part => part.type === 'text').text);
};
const percentile = (values, share) => values.length === 0 ? null : [...values].sort((left, right) => left - right)[Math.min(values.length - 1, Math.floor(values.length * share))];

const session = async variant => {
  const directory = join(artifact, variant.name);
  mkdirSync(directory);
  // Live files go to memory-backed storage: an append to a busy disk can block for many seconds, which
  // would stall the compositor's own logging and blur what is measured. They are copied to the artifact after.
  const live = mkdtempSync(join(liveRoot, 'ide-log-stall-' + variant.name + '-'));
  const fifo = join(live, 'stdout.fifo');
  if (spawnSync('mkfifo', ['--mode=600', fifo]).status !== 0) throw new Error('mkfifo failed for ' + fifo);
  // Opened for reading and writing so the open does not wait for a writer; nothing is read until the drain.
  const unread = openSync(fifo, 'r+');
  const socketPath = join(live, 'control.sock');
  const compositorLogPath = join(live, 'compositor.log');
  const compositorLog = openSync(compositorLogPath, 'w');
  const environment = { ...process.env, SLINT_BACKEND: 'winit', SLINT_MCP_PORT: port, FONTCONFIG_FILE: fontConfig, XDG_CONFIG_HOME: join(artifact, 'config'), XDG_CACHE_HOME: join(artifact, 'cache'), XDG_DATA_HOME: join(artifact, 'data'), IDE_STALL_FIFO: fifo, IDE_STALL_RUST_LOG: 'ide_app=debug,monochromatic_ide=debug' };
  if (runtime) environment.HELIX_RUNTIME = runtime;
  delete environment.RUST_LOG;
  // Only the IDE's standard output goes to the FIFO, and only the IDE gets RUST_LOG; the compositor logs to a file.
  // The compositor hands its own standard streams to the program it hosts, so the redirection happens in a shell
  // that then becomes the IDE (`exec`); redirecting the compositor itself would stall the compositor too.
  const launcher = ['/bin/sh', '-c', 'RUST_LOG="$IDE_STALL_RUST_LOG" exec "$0" "$@" >"$IDE_STALL_FIFO"', variant.binary, project, '--file', file];
  const host = spawn(compositor, ['--socket', socketPath, '--size', '1100x660', '--color-scheme', 'dark', '--', ...launcher], { env: environment, stdio: ['ignore', compositorLog, compositorLog] });
  const exited = new Promise(done => host.on('exit', (code, signal) => done({ code, signal })));
  const latencies = [];
  const probes = [];
  let timeouts = 0;
  let keys = 0;
  let measuredFrom;
  let measuredTo;
  const started = performance.now();
  try {
    // The MCP server binds its port from a task on the window's event loop, and the window appears later;
    // a loop that is blocked before either never answers, which counts as not answering, not as a setup failure.
    const ready = performance.now() + 120000;
    variant.windowShown = false;
    while (performance.now() < ready) {
      if (host.exitCode !== null) throw new Error(variant.name + ': the compositor exited early; inspect ' + directory);
      if (listening()) {
        try {
          const windows = await mcp('list_windows', {}, 5000);
          if (windows.windowHandles.length > 0) {
            variant.windowShown = true;
            break;
          }
        } catch (error) {
          // Not ready yet, or not answering; the loop's own deadline decides.
          variant.lastStartupError = String(error.message ?? error).slice(0, 120);
        }
      }
      await wait(200);
    }
    variant.windowAfterMs = variant.windowShown ? Math.round(performance.now() - started) : null;
    // Keys come at a steady pace whether or not the IDE answers; each caret move logs debug records.
    const end = performance.now() + seconds * 1000;
    measuredFrom = Date.now();
    let down = true;
    const typing = (async () => {
      while (variant.windowShown && performance.now() < end) {
        const response = await control(socketPath, 'key ' + (down ? 'down' : 'up'));
        if (response.startsWith('ok')) keys += 1;
        if (keys % 40 === 0) down = !down;
        await wait(50);
      }
    })();
    while (variant.windowShown && performance.now() < end) {
      const before = performance.now();
      const at = Date.now();
      try {
        await mcp('list_windows', {}, 5000);
        latencies.push(Math.round(performance.now() - before));
        probes.push([at - measuredFrom, latencies.at(-1)]);
      } catch (error) {
        if (error.name !== 'TimeoutError') throw error;
        timeouts += 1;
        probes.push([at - measuredFrom, 'stall']);
      }
      await wait(200);
    }
    await typing;
    measuredTo = Date.now();
  } finally {
    // Drain the FIFO so the IDE can write again, then quit it; the drained text holds any gap warning.
    // A non-blocking descriptor is read in a timer: a blocking read of a FIFO that this script also holds open
    // for writing would never return and keep the script alive after its work.
    const drained = [];
    const drainFd = openSync(fifo, constants.O_RDONLY | constants.O_NONBLOCK);
    const drainOnce = () => {
      const buffer = Buffer.alloc(65536);
      for (;;) {
        let count;
        try { count = readSync(drainFd, buffer, 0, buffer.length, null); } catch (error) { if (error.code === 'EAGAIN') return; throw error; }
        if (count === 0) return;
        drained.push(Buffer.from(buffer.subarray(0, count)));
      }
    };
    const draining = setInterval(drainOnce, 20);
    await wait(500);
    const quitAt = performance.now();
    await control(socketPath, 'quit').catch(() => host.kill('SIGTERM'));
    // The compositor gets time to stop its private bus; a forced kill leaves that bus behind.
    const outcome = await Promise.race([exited, wait(30000).then(() => undefined)]);
    if (outcome === undefined) {
      host.kill('SIGTERM');
      variant.exit = await Promise.race([exited, wait(10000).then(() => { host.kill('SIGKILL'); return { killed: true }; })]);
    } else variant.exit = outcome;
    variant.exitAfterQuitMs = Math.round(performance.now() - quitAt);
    clearInterval(draining);
    drainOnce();
    closeSync(drainFd);
    closeSync(unread);
    closeSync(compositorLog);
    // Processes the compositor started for this session (its private bus) must be gone with it.
    variant.leftovers = spawnSync('pgrep', ['--full', 'monochromatic-nested-wayland-session-' + host.pid + '-'], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean);
    for (const pid of variant.leftovers) spawnSync('kill', [pid]);
    const text = Buffer.concat(drained).toString().replaceAll(/\u001b\[[0-9;]*m/g, '');
    writeFileSync(join(directory, 'ide-log-drained.log'), text);
    copyFileSync(compositorLogPath, join(directory, 'compositor.log'));
    rmSync(live, { recursive: true, force: true });
    variant.drainedBytes = Buffer.concat(drained).length;
    variant.forcedByCompositor = readFileSync(join(directory, 'compositor.log'), 'utf8').includes('forcing shutdown');
    // The IDE stamps each key it handles on the window's thread; the longest pause between two of them inside
    // the measured interval is the window's own account of how long it could not handle input.
    const handled = text.split('\n').filter(line => line.includes('monochromatic_ide::native::input:')).map(line => Date.parse(line.slice(0, 27))).filter(at => at >= (measuredFrom ?? Infinity) && at <= (measuredTo ?? -Infinity));
    variant.keysHandled = handled.length;
    variant.measured = measuredFrom === undefined ? null : { from: new Date(measuredFrom).toISOString(), to: new Date(measuredTo).toISOString() };
    // The interval's start and end count as edges, so a window that stops handling keys for good shows that pause too.
    const edges = measuredFrom === undefined ? [] : [measuredFrom, ...handled, measuredTo];
    variant.longestInputPauseMs = edges.length > 1 ? Math.max(...edges.slice(1).map((at, index) => at - edges[index])) : null;
    variant.probes = probes;
    variant.gapWarnings = text.split('\n').filter(line => line.includes('were not written because the log output did not accept them')).map(line => line.slice(0, 220));
  }
  Object.assign(variant, { answers: latencies.length, timeouts, keys, p50Ms: percentile(latencies, 0.5), p99Ms: percentile(latencies, 0.99), maxMs: latencies.length ? Math.max(...latencies) : null });
  return variant;
};
// endregion

const results = [];
for (const variant of variants) {
  results.push(await session(variant));
  writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.at(-1)));
  if (listening()) throw new Error('Port ' + port + ' is still bound after the ' + variant.name + ' session');
}
const [current, synchronous] = results;
// Two accounts of the window's thread: the longest pause between two keys it handled (its own records,
// stamped when handled), and the Slint MCP server's answers. A pause or an unanswered probe of 5 s counts as a
// stall. A busy host can delay single answers by seconds without any log involved, so slower answers are
// recorded but do not decide the check.
const describe = item => item.keysHandled + ' keys handled, longest pause ' + item.longestInputPauseMs + ' ms; ' + item.answers + ' MCP answers, ' + item.timeouts + ' unanswered for 5 s, p50 ' + item.p50Ms + ' ms, p99 ' + item.p99Ms + ' ms; window shown: ' + item.windowShown;
const stalled = item => !item.windowShown || item.keysHandled === 0 || item.longestInputPauseMs >= 5000;
const checks = [
  ['with the background writer, the window kept handling input (' + describe(current) + ')', !stalled(current)],
  ['with the synchronous writer, the window stopped handling input (' + describe(synchronous) + ')', stalled(synchronous)],
  ['no process the compositor started outlived it', results.every(item => item.leftovers.length === 0)],
];
for (const [check, passed] of checks) console.log((passed ? 'PASS ' : 'FAIL ') + check);
writeFileSync(join(artifact, 'results.json'), JSON.stringify({ load: readFileSync('/proc/loadavg', 'utf8').trim(), results, checks }, null, 2));
console.log('Log stall check ' + (checks.every(([, passed]) => passed) ? 'passed' : 'FAILED') + ': ' + join(artifact, 'results.json'));
if (!checks.every(([, passed]) => passed)) process.exitCode = 1;

#!/usr/bin/env node
// Real mise projects against the production setup: servers found through mise and started confined, an untrusted
// configuration that falls back to PATH with the notice, a folder without mise that keeps the PATH lookup and its
// message, a hung mise that is stopped, and project trees compared before and after every run.
// Everything runs on disposable projects. The tools are the versions the user's mise already has installed (read with
// `mise ls --json`); nothing is installed, trusted, or written into a project, and no server touches this repository.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const binary = resolve('target/debug/ide-language-inspect');
// The private agent scratch root: its ancestors may hold other sessions' mise files, so the project without mise
// lives below the system temporary directory instead (the sandbox binds a project below /tmp again).
const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Scratch root must exclude group and other permissions: ' + privateRoot);
const base = realpathSync(mkdtempSync(join(privateRoot, 'ide-language-mise-')));
const outside = realpathSync(mkdtempSync(join(tmpdir(), 'ide-language-mise-')));
const results = join(base, 'results');
mkdirSync(results);
console.log('LANGUAGE_MISE_ARTIFACT=' + base);

const write = (root, relative, text) => {
  const target = join(root, relative);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, text);
};
const offsetOf = (text, needle, within = 0) => {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error('fixture text lacks ' + needle);
  return [...text.slice(0, index)].length + within;
};

// The versions mise has installed and active for the tools below.
const installed = JSON.parse(spawnSync('mise', ['ls', '--json'], { encoding: 'utf8', cwd: resolve('.') }).stdout);
const versionOf = name => {
  const found = (installed[name] ?? []).filter(entry => entry.installed);
  const chosen = found.find(entry => entry.active) ?? found.at(-1);
  if (!chosen) throw new Error('mise has no installed ' + name + '; this check never installs anything');
  return chosen.version;
};
const tools = ['taplo = "' + versionOf('taplo') + '"', 'node = "' + versionOf('node') + '"', '"npm:bash-language-server" = "' + versionOf('npm:bash-language-server') + '"'];

// What the desktop launcher has: the PATH line of the systemd user session, read for that line only.
const sessionPath = (() => {
  const shown = spawnSync('systemctl', ['--user', 'show-environment'], { encoding: 'utf8' });
  const line = (shown.stdout ?? '').split('\n').find(text => text.startsWith('PATH='));
  return line ? line.slice('PATH='.length) : process.env.PATH;
})();
console.log('launcher-like PATH entries: ' + sessionPath.split(':').length);

const script = [
  '#!/bin/sh',
  '# Greet one name.',
  'greet() {',
  '  echo "hello $1"',
  '}',
  '',
  'greet "world"',
  '',
].join('\n');
const dataToml = ['[package]', 'name = "example"', 'version = "0.1.0"', ''].join('\n');

// A project with a mise.toml that lists only tools, which mise trusts without `mise trust`.
const project = (root, extra = '') => {
  write(root, 'mise.toml', extra + '[tools]\n' + tools.join('\n') + '\n');
  write(root, 'run.sh', script);
  write(root, 'data.toml', dataToml);
};
const withMise = join(base, 'mise-project');
project(withMise);
// A configuration with `[env]` needs trust; this one was never trusted.
const untrusted = join(base, 'untrusted-project');
project(untrusted, '[env]\nPROJECT_MARK = "1"\n');
const hung = join(base, 'hung-project');
project(hung);
write(outside, 'a.lua', 'local value = 1\nprint(value)\n');

// A fake mise first on PATH that never answers, to see the time limit stop it.
const fakeBin = join(base, 'fake-bin');
write(fakeBin, 'mise', '#!/bin/sh\nexec sleep 600\n');
chmodSync(join(fakeBin, 'mise'), 0o755);

const plan = (root, steps) => ({ project: root, steps });
const bashHover = at => ({ label: 'hover', do: 'request', kind: 'hover', at, until: 'hover', seconds: 60 });
const cases = [
  {
    name: 'mise-project-node-server',
    root: withMise,
    path: sessionPath,
    plan: plan(withMise, [
      { label: 'open', do: 'open', file: 'run.sh' },
      { label: 'ready', do: 'ready', seconds: 60 },
      bashHover(offsetOf(script, 'greet "world"', 1)),
      { label: 'diagnostics', do: 'diagnostics', minimum: 0, maximum: 0, seconds: 2 },
      { label: 'close', do: 'close' },
    ]),
  },
  {
    name: 'mise-project-binary-server',
    root: withMise,
    path: sessionPath,
    plan: plan(withMise, [
      { label: 'open', do: 'open', file: 'data.toml' },
      { label: 'ready', do: 'ready', seconds: 60 },
      { label: 'diagnostics', do: 'diagnostics', minimum: 0, maximum: 0, seconds: 2 },
      { label: 'close', do: 'close' },
    ]),
  },
  {
    name: 'untrusted-project',
    root: untrusted,
    path: sessionPath,
    plan: plan(untrusted, [
      { label: 'open', do: 'open', file: 'run.sh' },
      { label: 'sleep', do: 'sleep', milliseconds: 1500 },
      { label: 'notice', do: 'diagnostics', minimum: 1, maximum: 100, seconds: 30 },
      { label: 'close', do: 'close' },
    ]),
  },
  {
    name: 'folder-without-mise',
    root: outside,
    path: sessionPath,
    plan: plan(outside, [
      { label: 'open', do: 'open', file: 'a.lua' },
      { label: 'sleep', do: 'sleep', milliseconds: 1500 },
      { label: 'notice', do: 'diagnostics', minimum: 1, maximum: 100, seconds: 30 },
      { label: 'close', do: 'close' },
    ]),
  },
  {
    name: 'hung-mise',
    root: hung,
    path: fakeBin + ':' + sessionPath,
    plan: plan(hung, [
      { label: 'open', do: 'open', file: 'run.sh' },
      { label: 'sleep', do: 'sleep', milliseconds: 1500 },
      { label: 'notice', do: 'diagnostics', minimum: 1, maximum: 100, seconds: 60 },
      { label: 'close', do: 'close' },
    ]),
  },
];

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
      entries[path.slice(root.length + 1)] = entry;
      if (stat.isDirectory()) walk(path);
    }
  };
  walk(root);
  return entries;
};
const difference = (before, after) => ({
  added: Object.keys(after).filter(key => !(key in before)),
  removed: Object.keys(before).filter(key => !(key in after)),
  changed: Object.keys(after).filter(key => key in before && JSON.stringify(before[key]) !== JSON.stringify(after[key])),
});
const unchanged = tree => tree.added.length === 0 && tree.removed.length === 0 && tree.changed.length === 0;

// Processes of the fixtures: working directory inside a fixture, or the fake mise's `sleep 600`.
const leftovers = () => readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(pid => {
  try {
    const cwd = readlinkSync(join('/proc', pid, 'cwd'));
    const command = readFileSync(join('/proc', pid, 'cmdline'), 'utf8').split('\0').join(' ').trim();
    const inside = cwd.startsWith(base) || cwd.startsWith(outside);
    return inside || command === 'sleep 600' ? [pid + ' ' + cwd + ' ' + command] : [];
  } catch { return []; }
});

const summary = { base, outside, tools, cases: [] };
let failed = false;
const report = (name, passed) => {
  if (!passed) failed = true;
  console.log((passed ? 'PASS ' : 'FAIL ') + name);
};
// The application's private state goes below the fixture. The launcher-like PATH replaces the shell's.
const environment = path => ({ ...process.env, PATH: path, XDG_CACHE_HOME: join(base, 'app-cache') });
const noticeText = events => events.filter(event => event.diagnostics).flatMap(event => event.diagnostics.items ?? [])
  .filter(item => item.source === 'language support').map(item => item.message).join('\n');

for (const item of cases) {
  const planPath = join(results, item.name + '.plan.json');
  writeFileSync(planPath, JSON.stringify(item.plan, null, 2));
  const before = snapshot(item.root);
  const started = Date.now();
  const run = spawnSync(binary, [planPath], { encoding: 'utf8', env: environment(item.path), maxBuffer: 64 * 1024 * 1024 });
  const seconds = (Date.now() - started) / 1000;
  const tree = difference(before, snapshot(item.root));
  writeFileSync(join(results, item.name + '.events.jsonl'), run.stdout ?? '');
  writeFileSync(join(results, item.name + '.stderr.txt'), run.stderr ?? '');
  if (run.error) throw run.error;
  const events = (run.stdout ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const steps = events.filter(event => event.step !== undefined);
  const result = label => steps[item.plan.steps.findIndex(step => step.label === label)]?.result ?? {};
  const replies = events.filter(event => event.reply).map(event => event.reply);
  const hover = replies.map(reply => reply.outcome.text ?? '').join('\n');
  const notice = noticeText(events);
  const stderr = run.stderr ?? '';
  const elapsed = [...stderr.matchAll(/elapsed_ms=(\d+)/g)].map(found => Number(found[1]));
  const checks = [['process exited cleanly', run.status === 0], ['every step was recorded', steps.length === item.plan.steps.length]];
  if (item.name === 'mise-project-node-server') {
    checks.push(['mise provided tool directories for the project', /mise provides tool directories for the project/.test(stderr)]);
    checks.push(['the Node server became ready through mise', result('ready').ready === true]);
    checks.push(['hover names the function', result('hover').matched === true && hover.includes('greet')]);
    checks.push(['no language support notice is shown', notice === '']);
  }
  if (item.name === 'mise-project-binary-server') {
    checks.push(['the binary server became ready through mise', result('ready').ready === true]);
    checks.push(['no language support notice is shown', notice === '']);
  }
  if (item.name === 'untrusted-project') {
    checks.push(['the notice quotes mise on the untrusted file', notice.includes('mise said:') && notice.includes('are not trusted')]);
    checks.push(['the notice names the configuration file', notice.includes(join(item.root, 'mise.toml'))]);
    checks.push(['the notice says the user runs mise trust', notice.includes('run `mise trust` on') && notice.includes('(the IDE never does)')]);
    checks.push(['the server falls back to PATH and its shim is not started', /bash-language-server is not available: the program 'bash-language-server' for bash-language-server was not found on PATH/.test(notice)]);
  }
  if (item.name === 'folder-without-mise') {
    checks.push(['the notice keeps the PATH message', /lua-language-server is not available: the program 'lua-language-server' for lua-language-server was not found on PATH\./.test(notice)]);
    checks.push(['mise is not mentioned', !/mise/i.test(notice)]);
    checks.push(['mise was not asked to provide anything', !/mise provides tool directories/.test(stderr)]);
  }
  if (item.name === 'hung-mise') {
    checks.push(['the hung mise was stopped at the time limit', notice.includes('did not finish within 10 s and was stopped')]);
    checks.push(['the whole run stayed near the limit', seconds < 40]);
  }
  checks.push(['the project tree is unchanged', unchanged(tree)]);
  const left = leftovers();
  checks.push(['no process is left in the fixtures', left.length === 0]);
  summary.cases.push({ name: item.name, seconds, miseMilliseconds: elapsed, tree, leftovers: left, notice, hover: hover.slice(0, 300), checks: checks.map(([name, passed]) => ({ name, passed })) });
  for (const [name, passed] of checks) report(item.name + ': ' + name, passed);
}

// Positive control: the comparison sees a `mise.lock`, the file mise writes when it updates a lockfile.
const control = join(base, 'control-project');
cpSync(withMise, control, { recursive: true });
const controlBefore = snapshot(control);
write(control, 'mise.lock', '# written by the control\n');
const controlTree = difference(controlBefore, snapshot(control));
report('control: the tree comparison sees a created mise.lock', controlTree.added.includes('mise.lock'));
rmSync(control, { recursive: true, force: true });
report('no mise.lock exists in any project', [withMise, untrusted, hung, outside].every(root => !existsSync(join(root, 'mise.lock'))));

writeFileSync(join(results, 'results.json'), JSON.stringify(summary, null, 2));
console.log('Language mise inspection ' + (failed ? 'FAILED' : 'passed') + ': ' + join(results, 'results.json'));
if (failed) process.exitCode = 1;

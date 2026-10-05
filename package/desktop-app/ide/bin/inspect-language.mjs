#!/usr/bin/env node
// Real-server checks of the headless Language module: all five feature paths, an external reload,
// and the stale-reply case, against disposable TypeScript and Rust projects on the host.
// Servers run with the production launch policy, confined by bubblewrap, so the project trees
// are compared before and after: only the file the plan itself rewrites may change.
// No server is ever pointed at this repository; it is read only to copy the TypeScript 7 packages.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const binary = resolve('target/debug/ide-language-inspect');
const store = resolve('../../../node_modules/.pnpm');
// The private agent scratch root, not /tmp: the sandbox replaces /tmp, so a project there is refused.
const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Scratch root must exclude group and other permissions: ' + privateRoot);
// Language servers report resolved paths, so the fixture root is resolved up front.
const base = realpathSync(mkdtempSync(join(privateRoot, 'ide-language-inspect-')));
const results = join(base, 'results');
mkdirSync(results);
console.log('LANGUAGE_INSPECT_ARTIFACT=' + base);

const write = (root, relative, text) => {
  const target = join(root, relative);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, text);
};
// Character offset (Unicode scalar values, as the application counts) of `needle` plus `within` characters.
const offsetOf = (text, needle, within = 0) => {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error('fixture text lacks ' + needle);
  return [...text.slice(0, index)].length + within;
};

// TypeScript project. An accented letter and an astral character precede the call on its line,
// so UTF-8, UTF-16, and character columns all differ.
const ts = join(base, 'ts-project');
write(ts, 'package.json', JSON.stringify({ name: 'inspect-ts', private: true, type: 'module' }, null, 2) + '\n');
write(ts, 'tsconfig.json', JSON.stringify({
  compilerOptions: { target: 'es2022', module: 'esnext', moduleResolution: 'bundler', strict: true, noEmit: true },
  include: ['src'],
}, null, 2) + '\n');
write(ts, 'src/greet.ts', ['/** Build a greeting for one name. */', 'export function greet(name: string): string {', '  return `hello ${name}`;', '}', ''].join('\n'));
const tsMain = [
  'import { greet } from "./greet";',
  '',
  'const label = "héllo 😀"; const message = greet("wörld");',
  'const count: number = "not a number";',
  'const biggest = Math.max(1, 2);',
  'console.log(label, message, count, biggest);',
  '',
].join('\n');
write(ts, 'src/main.ts', tsMain);
cpSync(join(store, 'typescript@7.0.2', 'node_modules', 'typescript'), join(ts, 'node_modules', 'typescript'), { recursive: true });
cpSync(
  join(store, '@typescript+typescript-linux-x64@7.0.2', 'node_modules', '@typescript', 'typescript-linux-x64'),
  join(ts, 'node_modules', '@typescript', 'typescript-linux-x64'),
  { recursive: true },
);

// Dependency-free Rust project of the same shape: a cross-file definition, a type error, a standard-library type.
const rust = join(base, 'rust-project');
write(rust, 'Cargo.toml', ['[package]', 'name = "inspect-rust"', 'version = "0.1.0"', 'edition = "2024"', '', '[workspace]', ''].join('\n'));
write(rust, 'src/shape.rs', ['/// Multiply width by height.', 'pub fn area(width: u32, height: u32) -> u32 {', '    width * height', '}', ''].join('\n'));
const rustMain = [
  'mod shape;',
  '',
  'use shape::area;',
  '',
  'fn main() {',
  '    let label = "héllo 😀"; let total = area(2, 3);',
  '    let wrong: u32 = "not a number";',
  '    let name = String::new();',
  '    println!("{label} {total} {wrong} {name}");',
  '}',
  '',
].join('\n');
write(rust, 'src/main.rs', rustMain);

// One plan per language. `fixed` removes the type error and shifts every later position by one line.
const plan = ({ project, file, text, call, external, wrong, right, warm, settle }) => {
  const fixed = '// reloaded\n' + text.replace(wrong, right);
  const broken = '// reloaded twice\n' + text;
  return {
    project,
    steps: [
      { label: 'open', do: 'open', file },
      { label: 'ready', do: 'ready', seconds: warm },
      { label: 'hover', do: 'request', kind: 'hover', at: offsetOf(text, call, 1), until: 'hover', seconds: warm },
      { label: 'definition', do: 'request', kind: 'definition', at: offsetOf(text, call, 1), until: 'locations', seconds: warm },
      { label: 'references', do: 'request', kind: 'references', at: offsetOf(text, call, 1), until: 'locations', seconds: warm },
      { label: 'external', do: 'request', kind: 'definition', at: offsetOf(text, external, 1), until: 'locations', seconds: warm },
      { label: 'blank', do: 'request', kind: 'hover', at: offsetOf(text, '\n\n', 1), until: 'empty', seconds: warm },
      { label: 'hints', do: 'hints', first: 0, visible: 40, minimum: 1, seconds: warm },
      { label: 'diagnostics', do: 'diagnostics', minimum: 1, maximum: 100, seconds: warm },
      { label: 'reload', do: 'reload', text: fixed },
      { label: 'hover-reloaded', do: 'request', kind: 'hover', at: offsetOf(fixed, call, 1), until: 'hover', seconds: warm },
      { label: 'definition-reloaded', do: 'request', kind: 'definition', at: offsetOf(fixed, call, 1), until: 'locations', seconds: warm },
      { label: 'hints-reloaded', do: 'hints', first: 0, visible: 40, minimum: 1, seconds: warm },
      // An empty set is published at the reload itself, so the fix is judged only after the servers had time to answer.
      { label: 'settle', do: 'sleep', milliseconds: settle },
      { label: 'diagnostics-fixed', do: 'diagnostics', minimum: 0, maximum: 0, seconds: 1 },
      { label: 'stale', do: 'stale', at: offsetOf(fixed, call, 1), text: broken, settle: 4000 },
      { label: 'hover-restored', do: 'request', kind: 'hover', at: offsetOf(broken, call, 1), until: 'hover', seconds: warm },
      { label: 'diagnostics-restored', do: 'diagnostics', minimum: 1, maximum: 100, seconds: warm },
      { label: 'close', do: 'close' },
    ],
  };
};
const cases = [
  {
    name: 'typescript',
    plan: plan({ project: ts, file: 'src/main.ts', text: tsMain, call: 'greet("wörld")', external: 'max(1, 2)', wrong: '"not a number"', right: '7', warm: 60, settle: 5000 }),
    definition: 'src/greet.ts', external: 'lib.es5.d.ts', externalOutside: false, hover: 'greet', diagnostic: '2322',
  },
  {
    name: 'rust',
    plan: plan({ project: rust, file: 'src/main.rs', text: rustMain, call: 'area(2, 3)', external: 'String::new', wrong: '"not a number"', right: '7', warm: 120, settle: 15000 }),
    definition: 'src/shape.rs', external: 'string.rs', externalOutside: true, hover: 'area', diagnostic: 'E0308',
  },
];

// Processes whose working directory is inside the fixture, read from /proc.
const leftovers = () => readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(pid => {
  try {
    const cwd = readlinkSync(join('/proc', pid, 'cwd'));
    return cwd.startsWith(base) ? [pid + ' ' + cwd + ' ' + readFileSync(join('/proc', pid, 'comm'), 'utf8').trim()] : [];
  } catch { return []; }
});

const version = (command, args) => (spawnSync(command, args, { encoding: 'utf8' }).stdout ?? '').trim();
const summary = {
  base,
  versions: {
    rustAnalyzer: version('rust-analyzer', ['--version']),
    node: version('node', ['--version']),
    typescript: JSON.parse(readFileSync(join(ts, 'node_modules', 'typescript', 'package.json'), 'utf8')).version,
  },
  cases: [],
};
// The application's private state, which holds each server's cargo and cache redirects, goes below the fixture.
// No cargo redirect is set here: the launch policy sets them inside the sandbox.
const env = { ...process.env, XDG_CACHE_HOME: join(base, 'app-cache') };
delete env.CARGO_TARGET_DIR;
delete env.CARGO_BUILD_BUILD_DIR;
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
let failed = false;
for (const item of cases) {
  const planPath = join(results, item.name + '.plan.json');
  writeFileSync(planPath, JSON.stringify(item.plan, null, 2));
  // node_modules is a read-only copy for the TypeScript server; its tree is compared too.
  const before = snapshot(item.plan.project);
  const run = spawnSync(binary, [planPath], { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  const after = snapshot(item.plan.project);
  const tree = {
    added: Object.keys(after).filter(key => !(key in before)),
    removed: Object.keys(before).filter(key => !(key in after)),
    changed: Object.keys(after).filter(key => key in before && JSON.stringify(before[key]) !== JSON.stringify(after[key])),
  };
  writeFileSync(join(results, item.name + '.events.jsonl'), run.stdout ?? '');
  writeFileSync(join(results, item.name + '.stderr.txt'), run.stderr ?? '');
  if (run.error) throw run.error;
  const events = (run.stdout ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const steps = events.filter(event => event.step !== undefined);
  const indexOf = label => item.plan.steps.findIndex(step => step.label === label);
  const result = label => steps[indexOf(label)]?.result ?? {};
  const repliesOf = label => {
    // Replies recorded between the previous step record and this one belong to this step.
    const index = indexOf(label);
    const end = events.indexOf(steps[index]);
    const start = index === 0 ? 0 : events.indexOf(steps[index - 1]);
    return events.slice(start, end).filter(event => event.reply).map(event => event.reply);
  };
  const lastOf = (label, key) => {
    const end = events.indexOf(steps[indexOf(label)]);
    return events.slice(0, end).filter(event => event[key]).at(-1)?.[key];
  };
  const targets = label => repliesOf(label).flatMap(reply => reply.outcome.targets ?? []);
  const hoverText = label => repliesOf(label).map(reply => reply.outcome.text ?? '').join('\n');
  const checks = [
    ['process exited cleanly', run.status === 0],
    ['every step was recorded', steps.length === item.plan.steps.length],
    ['a server became ready', result('ready').ready === true],
    ['hover names the called function', result('hover').matched === true && hoverText('hover').includes(item.hover)],
    ['definition opens the other project file', targets('definition').some(target => target.path?.endsWith(item.definition) && target.outsideProject === false && Array.isArray(target.range))],
    ['references include both files', targets('references').some(target => target.sameDocument) && targets('references').some(target => target.path?.endsWith(item.definition))],
    ['dependency definition is ' + (item.externalOutside ? 'flagged outside project' : 'inside the project'), targets('external').some(target => target.path?.endsWith(item.external) && target.outsideProject === item.externalOutside)],
    ['hover on a blank line is an empty result', result('blank').matched === true],
    ['inlay hints arrived', result('hints').enough === true && (lastOf('hints', 'hints')?.items.length ?? 0) > 0],
    ['diagnostics name the type error', result('diagnostics').within === true && JSON.stringify(lastOf('diagnostics', 'diagnostics')).includes(item.diagnostic)],
    ['hover after the reload names the same function', result('hover-reloaded').matched === true && hoverText('hover-reloaded').includes(item.hover)],
    ['definition after the reload still resolves', targets('definition-reloaded').some(target => target.path?.endsWith(item.definition))],
    ['inlay hints after the reload describe the new revision', result('hints-reloaded').enough === true && lastOf('hints-reloaded', 'hints')?.revision === 1],
    ['diagnostics stay empty after the fix', result('diagnostics-fixed').within === true],
    ['the overtaken reply was not delivered', result('stale').delivered === false],
    ['hover works after the stale case', result('hover-restored').matched === true && hoverText('hover-restored').includes(item.hover)],
    ['diagnostics return with the restored error', result('diagnostics-restored').within === true && JSON.stringify(lastOf('diagnostics-restored', 'diagnostics')).includes(item.diagnostic)],
  ];
  const left = leftovers();
  checks.push(['no process is left in the fixture', left.length === 0]);
  // The plan's reload steps rewrite the displayed file from the application side; nothing else may change.
  checks.push(['the servers added and removed nothing in the project', tree.added.length === 0 && tree.removed.length === 0]);
  checks.push(['only the reloaded file changed', tree.changed.every(path => path === item.plan.steps[0].file)]);
  const record = {
    name: item.name,
    exit: run.status,
    tree,
    staleCase: result('stale'),
    fence: events.find(event => event.done)?.fence,
    leftovers: left,
    projectEntries: readdirSync(item.plan.project).sort(),
    checks: checks.map(([name, passed]) => ({ name, passed })),
  };
  summary.cases.push(record);
  for (const [name, passed] of checks) {
    if (!passed) failed = true;
    console.log((passed ? 'PASS ' : 'FAIL ') + item.name + ': ' + name);
  }
}
writeFileSync(join(results, 'results.json'), JSON.stringify(summary, null, 2));
console.log('Language inspection ' + (failed ? 'FAILED' : 'passed') + ': ' + join(results, 'results.json'));
if (failed) process.exitCode = 1;

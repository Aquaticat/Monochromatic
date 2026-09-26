/**
 Declared inputs of every shipped policy, checked against what each policy actually touches.

 Each traced check runs one policy in a child Node process under `strace`,
 between two marker syscalls,
 and fails when the policy touched a file or started a program its declaration does not name.
 Context facts are in memory,
 so a context-only policy may touch nothing outside the system prefixes a Node process always uses.

 @module
 */
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  tmpdir,
} from 'node:os';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { pathToFileURL, } from 'node:url';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import {
  forbiddenStringsPolicy,
  internalTestExports,
  markdownLintPolicy,
  type PolicyInputs,
  repositoryPolicyPlugin,
} from '../../dist/final/node/index.mjs';

const {
  BUILT_IN_POLICIES,
  effectivePolicyInputs,
} = internalTestExports;

/**
 Built artifact the child imports.
 */
const DIST = pathToFileURL(join(import.meta.dirname, '..', '..', 'dist', 'final', 'node', 'index.mjs',),).href;

/**
 Scanner binary built beside the forbidden-strings crate.
 */
const SCANNER = join(import.meta.dirname, '..', '..', '..', '..', 'cli', 'forbidden-strings', 'target', 'release', 'forbidden-strings',);

/**
 Whether `strace` can trace a child here.
 */
const STRACE_AVAILABLE = await (async function probeStrace(): Promise<boolean> {
  try {
    await nanoSpawn('strace', ['-qq', '-e', 'trace=none', 'true',],);
    return true;
  }
  catch (error: unknown) {
    return String(error,).length < 0;
  }
})();

/**
 Prefixes every Node process and dynamically linked program touches regardless of policy.
 */
const SYSTEM_PREFIXES: readonly string[] = ['/proc/', '/sys/', '/dev/', '/etc/localtime', '/usr/share/zoneinfo', '/etc/ld.so', '/lib/', '/lib64/', '/usr/lib', '/usr/lib64/',];

/**
 Child program: builds in-memory facts over the given files, runs one policy between trace markers, and prints its findings.
 */
const CHILD_SOURCE = `
import { statSync } from 'node:fs';
const input = JSON.parse(process.argv[2]);
const dist = await import(input.dist);
const { ABSENT_GIT_VALUE } = dist;
const encoder = new TextEncoder();
const policies = [
  ...dist.internalTestExports.BUILT_IN_POLICIES,
  ...dist.repositoryPolicyPlugin.policies,
  dist.forbiddenStringsPolicy,
];
const policy = policies.find((candidate) => candidate.name === input.policy);
const matches = (pathspec, path) => {
  if (!pathspec.startsWith(':(glob)')) return pathspec === path;
  const pattern = pathspec.slice(':(glob)'.length);
  if (pattern.endsWith('/src/**')) return path.startsWith(pattern.slice(0, -2));
  const a = pattern.split('/'); const b = path.split('/');
  return a.length === b.length && a.every((segment, index) => segment === '*' || segment === b[index]);
};
const oid = (text) => 'oid' + String(text.length) + text.replace(/[^a-z0-9]/giu, '').slice(0, 20);
const tracked = input.files.map((file) => ({
  targetId: 'tracked:' + file.path,
  path: file.path,
  revision: oid(file.text),
  mode: 'regular',
  headRevision: file.headText === undefined ? ABSENT_GIT_VALUE : oid(file.headText),
  bytes: async () => encoder.encode(file.text),
  headBytes: async () => file.headText === undefined ? ABSENT_GIT_VALUE : encoder.encode(file.headText),
}));
const candidates = input.files.filter((file) => file.text !== file.headText).map((file) => ({
  targetId: 'candidate:' + file.path,
  path: file.path,
  revision: oid(file.text),
  mode: 'regular',
  change: file.headText === undefined ? 'added' : 'modified',
  bytes: async () => encoder.encode(file.text),
}));
const context = {
  candidateVersion: 0,
  canApplyPatches: true,
  trigger: 'pre-forward',
  command: {
    rawArgs: input.args,
    transformedArgs: input.args,
    subcommand: input.args[0],
    effectiveCwd: input.root,
    repositoryRoot: input.root,
    escapedPolicyIds: new Set(),
  },
  git: {
    candidates: async () => candidates,
    trackedFiles: async ({ pathspecs }) => tracked.filter((file) => pathspecs.some((pathspec) => matches(pathspec, file.path))),
    headOid: async () => 'base',
    landedCommitOid: async () => ABSENT_GIT_VALUE,
    pushUpdates: async () => [],
  },
  signal: new AbortController().signal,
};
const marker = (name) => { try { statSync('/cli-git-policy-trace-' + name); } catch {} };
marker('begin');
const findings = await policy.check({ context, options: input.options });
marker('end');
process.stdout.write(JSON.stringify(findings.map((finding) => ({ code: finding.code, path: finding.path }))));
`;

/**
 One touched path between the markers.
 */
type Touch = Readonly<{
  /**
   Syscall name.
   */
  syscall: string;
  /**
   Absolute path.
   */
  path: string;
}>;

/**
 One fixture file.
 */
type TraceFile = Readonly<{
  /**
   Repository path.
   */
  path: string;
  /**
   Current text.
   */
  text: string;
  /**
   Parent text, absent for an added file.
   */
  headText?: string;
}>;

/**
 Paths touched by one traced policy check, with its findings.

 @param policy - policy name as the child looks it up

 @param files - fixture files

 @param args - command arguments

 @param options - policy options

 @param environment - child environment

 @param root - repository root the context names, and the scanner's working directory

 @returns touches between the markers and findings
 */
async function traceCheck({
  policy,
  files,
  args = ['commit', '-m', 'x',],
  options,
  environment = {},
  root,
}: Readonly<{
  policy: string;
  files: readonly TraceFile[];
  args?: readonly string[];
  options?: unknown;
  environment?: Readonly<Record<string, string>>;
  root: string;
}>,): Promise<Readonly<{
  touches: readonly Touch[];
  findings: unknown;
}>> {
  /**
   Child program.
   */
  const child = join(root, '..', 'child.mjs',);
  await writeFile(child, CHILD_SOURCE,);
  /**
   Trace log.
   */
  const log = join(root, '..', `${policy}.strace`,);
  /**
   Child result.
   */
  const result = await nanoSpawn('strace', [
    '-f',
    '-qq',
    '-e',
    'trace=%file,%process',
    '-o',
    log,
    process.execPath,
    child,
    JSON.stringify({ dist: DIST, policy, files, args, options, root, },),
  ], { cwd: root, env: { ...process.env, ...environment, }, },);
  /**
   Trace lines.
   */
  const lines = (await readFile(log, 'utf8',)).split('\n',);
  /**
   Marker positions.
   */
  const begin = lines.findIndex(function isBegin(line,): boolean {
    return line.includes('/cli-git-policy-trace-begin',);
  },);
  /**
   End marker position.
   */
  const end = lines.findIndex(function isEnd(line,): boolean {
    return line.includes('/cli-git-policy-trace-end',);
  },);
  expect(begin,).toBeGreaterThan(-1,);
  expect(end,).toBeGreaterThan(begin,);
  return {
    findings: JSON.parse(result.stdout,),
    touches: lines.slice(begin + 1, end,).flatMap(function touched(line,): readonly Touch[] {
      /**
       Syscall name after the PID.
       */
      const syscall = line.slice(line.indexOf(' ',) + 1, line.indexOf('(',),);
      /**
       First quoted argument.
       */
      const quoteStart = line.indexOf('"',);
      if (quoteStart === (-1))
        return [];
      /**
       Raw path.
       */
      const path = line.slice(quoteStart + 1, line.indexOf('"', quoteStart + 1,),);
      return [{ syscall, path: isAbsolute(path,) ? path : resolve(root, path,), },];
    },),
  };
}

/**
 Touches outside the system prefixes and the given allowances.

 @param touches - traced touches

 @param allowed - extra allowed path prefixes

 @returns remaining touches
 */
function undeclared({
  touches,
  allowed,
}: Readonly<{
  touches: readonly Touch[];
  allowed: readonly string[];
}>,): readonly Touch[] {
  return touches.filter(function isUndeclared(touch,): boolean {
    return ![...SYSTEM_PREFIXES, ...allowed,].some(function covers(prefix,): boolean {
      return touch.path.startsWith(prefix,);
    },);
  },);
}

/**
 Whether a touch only locates the repository:
 the working directory itself,
 or a `.git` entry of it or an ancestor,
 both fixed for the whole commit transaction.

 @param touch - traced touch

 @param root - repository root

 @returns whether the touch reads no content an input could name
 */
function isRepositoryIdentity({
  touch,
  root,
}: Readonly<{
  touch: Touch;
  root: string;
}>,): boolean {
  if (touch.path === root)
    return ['chdir', 'getcwd', 'statx', 'newfstatat', 'stat', 'lstat',].includes(touch.syscall,);
  return touch.path.endsWith('/.git',) && `${root}/`.startsWith(touch.path.slice(0, -'.git'.length,),)
    && ['statx', 'newfstatat', 'stat', 'lstat', 'access',].includes(touch.syscall,);
}

/**
 Disposable directory holding a repository root and trace files.

 @returns root and disposal
 */
async function createTraceRoot(): Promise<Readonly<{
  root: string;
  [Symbol.asyncDispose]: () => Promise<void>;
}>> {
  /**
   Scratch.
   */
  const scratch = await realpath(
    await mkdtemp(join(tmpdir(), 'cli-git-policy-trace-',),),
  );
  /**
   Repository root.
   */
  const root = join(scratch, 'repo',);
  await mkdir(root,);
  return {
    root,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(scratch, { recursive: true, force: true, },);
    },
  };
}

/**
 Manifest text.

 @param manifest - manifest object

 @returns formatted text
 */
function manifestText(manifest: Readonly<Record<string, unknown>>,): string {
  return `${JSON.stringify(manifest, undefined, 2,)}\n`;
}

/**
 Context-only policies with a fixture that drives each through its reads.
 */
const CONTEXT_ONLY_CASES: readonly Readonly<{
  policy: string;
  args?: readonly string[];
  files: readonly TraceFile[];
  findings: unknown;
}>[] = [
  {
    policy: 'add-explicit',
    args: ['add', '.',],
    files: [],
    findings: [{ code: 'bulk-add-rejected', },],
  },
  {
    policy: 'final-newline',
    files: [{ path: 'a.txt', text: 'no newline', headText: 'old\n', },],
    findings: [{ code: 'noncanonical-final-newline', path: 'a.txt', },],
  },
  {
    policy: 'forbidden-root-context',
    files: [{ path: 'CONTEXT.md', text: 'context\n', },],
    findings: [{ code: 'root-context-forbidden', path: 'CONTEXT.md', },],
  },
  {
    policy: 'dependent-version-bump',
    files: [
      { path: 'package/config/pnpr/config.yaml', text: "packages:\n  - '@s/base'\n  - '@s/runtime'\n", headText: "packages:\n  - '@s/base'\n  - '@s/runtime'\n", },
      { path: 'package/module/base/package.json', text: manifestText({ name: '@s/base', version: '1.1.0', },), headText: manifestText({ name: '@s/base', version: '1.0.0', },), },
      {
        path: 'package/module/runtime/package.json',
        text: manifestText({ name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*', }, },),
        headText: manifestText({ name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*', }, },),
      },
    ],
    findings: [{ code: 'dependent-version-stale', path: 'package/module/runtime/package.json', },],
  },
];

await describe({
  name: '',
  // Traced children are heavy; one at a time keeps the host responsive.
  concurrency: 1,
  children: [
    describe({
      name: 'shipped declarations',
      children: [
        it({
          name: 'built-ins that read only their context declare no external inputs; the others stay unrestricted',
          fn: async function testBuiltIns(): Promise<void> {
            expect(
              Object.fromEntries(BUILT_IN_POLICIES.map(function declared(policy,) {
              return [policy.name, effectivePolicyInputs(policy,),];
            },),),
            ).toEqual({
              'require-root': 'unrestricted',
              'linked-worktree-only': 'unrestricted',
              'branch-worktree-only': 'unrestricted',
              'add-explicit': { external: [], },
              'final-newline': { external: [], },
            },);
          },
        },),
        it({
          name: 'repository policies are context-only and markdown autofix is unrestricted',
          fn: async function testPlugins(): Promise<void> {
            expect(repositoryPolicyPlugin.policies.map(function declared(policy,) {
              return [policy.name, policy.inputs,];
            },),).toEqual([
              ['forbidden-root-context', { external: [], },],
              ['dependent-version-bump', { external: [], },],
            ],);
            expect(markdownLintPolicy.inputs,).toBe('unrestricted',);
          },
        },),
        it({
          name: 'forbidden-strings declares its configured scanner, FORBIDDEN_STRINGS_RULES, and the rules file it names',
          fn: async function testForbiddenStrings(): Promise<void> {
            /** Declaration function. */
            const {inputs} = forbiddenStringsPolicy;
            if ((typeof inputs) !== 'function')
              throw new TypeError('forbidden-strings must declare its inputs as a function of its options.',);
            /** Previous override. */
            const previous = process.env.FORBIDDEN_STRINGS_RULES;
            /** Restores the override. */
            using _restore = {
              [Symbol.dispose]: function restore(): void {
                if (previous === undefined)
                  delete process.env.FORBIDDEN_STRINGS_RULES;
                else
                  process.env.FORBIDDEN_STRINGS_RULES = previous;
              },
            };
            delete process.env.FORBIDDEN_STRINGS_RULES;
            expect((inputs as (options: unknown) => PolicyInputs)({ executable: './scanner', builtinRules: true, },),).toEqual({
              external: [
                { kind: 'executable', path: './scanner', },
                { kind: 'env', name: 'FORBIDDEN_STRINGS_RULES', },
                { kind: 'worktree', pathspecs: [':(literal)forbidden-strings.local.txt',], },
              ],
            },);
            process.env.FORBIDDEN_STRINGS_RULES = '/repo/.cache/rules.txt';
            expect((inputs as (options: unknown) => PolicyInputs)({ executable: 'forbidden-strings', builtinRules: false, },),).toEqual({
              external: [
                { kind: 'executable', path: 'forbidden-strings', },
                { kind: 'env', name: 'FORBIDDEN_STRINGS_RULES', },
                { kind: 'worktree', pathspecs: [':(literal)/repo/.cache/rules.txt',], },
              ],
            },);
          },
        },),
      ],
    },),
    describe({
      name: 'traced reads',
      children: [
        ...CONTEXT_ONLY_CASES.map(function contextOnlyCase({ policy, args, files, findings, },) {
          return it({
            name: `${policy} touches no file and starts no program while it checks`,
            skip: STRACE_AVAILABLE ? false : 'strace is unavailable',
            timeout: 60_000,
            fn: async function testContextOnly(): Promise<void> {
              await using directory = await createTraceRoot();
              /** Traced check. */
              const traced = await traceCheck({ policy, files, root: directory.root, ...(args === undefined ? {} : { args, }), },);
              expect(traced.findings,).toEqual(findings,);
              expect(undeclared({ touches: traced.touches, allowed: [], },),).toEqual([],);
            },
          },);
        },),
        it({
          name: 'forbidden-strings touches only its declared scanner and rules file besides its candidates and content-keyed cache',
          skip: STRACE_AVAILABLE ? false : 'strace is unavailable',
          timeout: 120_000,
          fn: async function testScanner(): Promise<void> {
            await using directory = await createTraceRoot();
            /** Rules file inside the repository, as FORBIDDEN_STRINGS_RULES names it. */
            const rules = join(directory.root, '.cache', 'rules.local.txt',);
            await mkdir(join(directory.root, '.cache',),);
            await writeFile(rules, 'RUNTIME_CACHE_RULE_LONG\n',);
            // Files the scanner must not read: the default rules file and an appendix.
            await writeFile(join(directory.root, 'forbidden-strings.local.txt',), 'OTHER_RULE_THAT_IS_LONG\n',);
            await writeFile(join(directory.root, 'forbidden-strings.append.txt',), 'APPENDED_RULE_THAT_IS_LONG\n',);
            /** Cache directory the scanner may use. */
            const cache = join(directory.root, '..', 'cache',);
            /** Scanner options. */
            const options = { executable: SCANNER, builtinRules: false, };
            /** Traced scan. */
            const traced = await traceCheck({
              policy: 'forbidden-strings',
              files: [{ path: 'a.txt', text: 'x RUNTIME_CACHE_RULE_LONG\n', }, { path: 'b.txt', text: 'OTHER_RULE_THAT_IS_LONG\n', },],
              options,
              environment: { FORBIDDEN_STRINGS_RULES: rules, FORBIDDEN_STRINGS_CACHE_DIR: cache, },
              root: directory.root,
            },);
            expect(traced.findings,).toEqual([{ code: 'forbidden-string', path: 'a.txt', },],);
            /** Declared inputs with the same override. */
            const previous = process.env.FORBIDDEN_STRINGS_RULES;
            process.env.FORBIDDEN_STRINGS_RULES = rules;
            /** Declared external inputs. */
            const declared = (forbiddenStringsPolicy.inputs as (options: unknown) => PolicyInputs)(options,);
            if (previous === undefined)
              delete process.env.FORBIDDEN_STRINGS_RULES;
            else
              process.env.FORBIDDEN_STRINGS_RULES = previous;
            if (declared === 'unrestricted')
              throw new TypeError('forbidden-strings must declare its inputs.',);
            /** Declared paths: the literal worktree pathspecs and the scanner. */
            const declaredPaths = declared.external.flatMap(function pathOf(input,): readonly string[] {
              if (input.kind === 'worktree')
                return input.pathspecs.map(function literal(pathspec,): string {
                  return resolve(directory.root, pathspec.replace(':(literal)', '',),);
                },);
              if (input.kind === 'executable')
                return [resolve(directory.root, input.path,),];
              return [];
            },);
            expect(undeclared({
              touches: traced.touches.filter(function notRepositoryIdentity(touch,): boolean {
                return !isRepositoryIdentity({ touch, root: directory.root, },);
              },),
              allowed: [...declaredPaths, join(tmpdir(), 'cli-git-forbidden-strings-',), cache,],
            },),).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);

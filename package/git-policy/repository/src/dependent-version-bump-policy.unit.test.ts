/** Dependent version bump policy unit tests over a fake policy context. @module */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  ABSENT_GIT_VALUE,
  DEPENDENT_VERSION_STALE_CODE,
  DEPENDENT_VERSION_UNSUPPORTED_CODE,
  dependentVersionBump,
  findDependentBumps,
  readPublishableNames,
  repositoryPolicyPlugin,
  type RepositoryCandidateFile as CandidateFile,
  type RepositoryPolicyContext as PolicyContext,
  type RepositoryTrackedFile as TrackedFile,
} from '../dist/final/node/index.mjs';

/**
 Text encoder for fixture bytes.
 */
const ENCODER = new TextEncoder();

/**
 Text decoder for patch bytes.
 */
const DECODER = new TextDecoder();

/**
 One tracked fixture file: current text and optional `HEAD` text.
 */
type FixtureFile = Readonly<{
  /**
   Repository path.
   */
  path: string;
  /**
   Current text.
   */
  text: string;
  /**
   `HEAD` text, absent for a new file.
   */
  headText?: string;
}>;

/**
 Serializes a manifest fixture the way workspace manifests are formatted.

 @param manifest - manifest object

 @returns manifest text with trailing newline
 */
function manifestText(manifest: Readonly<Record<string, unknown>>,): string {
  return `${JSON.stringify(manifest, undefined, 2,)}\n`;
}

/**
 Builds a tracked file from a fixture.

 @param file - fixture file

 @returns tracked file with fake revisions derived from the path
 */
function trackedFile(file: FixtureFile,): TrackedFile {
  /**
   Fake revision that changes when the text changes.
   */
  const revision = `${'a'.repeat(39,)}${String(file.text.length % 10,)}`;
  return {
    targetId: `tracked:${revision}:${file.path}`,
    path: file.path,
    revision,
    mode: 'regular',
    headRevision: file.headText === undefined ? ABSENT_GIT_VALUE : `${'b'.repeat(39,)}0`,
    bytes: async function currentBytes() {
      return ENCODER.encode(file.text,);
    },
    headBytes: async function baselineBytes() {
      return file.headText === undefined ? ABSENT_GIT_VALUE : ENCODER.encode(file.headText,);
    },
  };
}

/**
 Minimal glob matcher for the pathspecs the policy requests.

 @param pathspec - `:(glob)` pathspec or literal path

 @param path - repository path

 @returns whether the path matches
 */
function matchesPathspec(pathspec: string,path: string,): boolean {
  if (!pathspec.startsWith(':(glob)',))
    return pathspec === path;
  /**
   Glob pattern without magic prefix.
   */
  const pattern = pathspec.slice(':(glob)'.length,);
  if (pattern.endsWith('/src/**',))
    return path.startsWith(pattern.slice(0, -'**'.length,),);
  /**
   Pattern and path segments.
   */
  const [patternSegments, pathSegments,] = [pattern.split('/',), path.split('/',),];
  return (patternSegments.length === pathSegments.length)
    && patternSegments.every(function segmentMatches(segment, index,) {
      return (segment === '*') || (segment === pathSegments[index]);
    },);
}

/**
 Builds a policy context over fixture files, treating files whose text differs from `HEAD` as candidates.

 @param files - fixture repository files

 @param canApplyPatches - whether the lifecycle applies patches

 @param subcommand - forwarded Git subcommand

 @returns fake policy context
 */
function contextOf(files: readonly FixtureFile[], canApplyPatches = true, subcommand = 'commit',): PolicyContext {
  /**
   Tracked file views.
   */
  const tracked = files.map(trackedFile,);
  return {
    candidateVersion: 0,
    canApplyPatches,
    trigger: 'pre-forward',
    command: {
      rawArgs: [subcommand,],
      transformedArgs: [subcommand,],
      subcommand,
      effectiveCwd: '/repo',
      repositoryRoot: '/repo',
      escapedPolicyIds: new Set<string>(),
    },
    git: {
      candidates: async function candidates(): Promise<readonly CandidateFile[]> {
        return files
          .filter(function isChanged(file,) {
            return file.text !== file.headText;
          },)
          .map(function toCandidate(file,): CandidateFile {
            /**
             Tracked view of the same file.
             */
            const view = trackedFile(file,);
            return {
              targetId: `pre-commit:${view.revision}:${file.path}`,
              path: file.path,
              revision: view.revision,
              mode: 'regular',
              change: file.headText === undefined ? 'added' : 'modified',
              bytes: view.bytes,
            };
          },);
      },
      trackedFiles: async function trackedFiles({ pathspecs, },) {
        return tracked.filter(function matchesAny(file,) {
          return pathspecs.some(function matches(pathspec,) {
            return matchesPathspec(pathspec, file.path,);
          },);
        },);
      },
      headOid: async function headOid() {
        return 'head';
      },
      landedCommitOid: async function landedCommitOid() {
        return ABSENT_GIT_VALUE;
      },
      pushUpdates: async function pushUpdates() {
        return [];
      },
    },
    signal: new AbortController().signal,
  };
}

/**
 Generated pnpr config fixture listing publishable names.

 @param names - publishable package names

 @returns config fixture file
 */
function configFile(names: readonly string[],): FixtureFile {
  /**
   Config text in the generator's list shape.
   */
  const text = `auth:\n  oidc:\n    - workloads:\n        - registry: r\n          packages:\n${names.map(function toItem(name,) {
    return `            - '${name}'`;
  },).join('\n',)}\n\nweb:\n  enable: false\n`;
  return {
    path: 'package/config/pnpr/config.yaml',
    text,
    headText: text,
  };
}

/**
 Unchanged manifest fixture.

 @param directory - package directory

 @param manifest - manifest object

 @returns fixture file whose text equals `HEAD`
 */
function unchangedManifest(directory: string, manifest: Readonly<Record<string, unknown>>,): FixtureFile {
  /**
   Manifest text.
   */
  const text = manifestText(manifest,);
  return {
    path: `${directory}/package.json`,
    text,
    headText: text,
  };
}

await describe({
  name: '',
  children: [
    describe({
      name: dependentVersionBump.name,
      children: [
        it({
          name: 'is registered by the repository plugin with blocking defaults',
          fn: async function testRegistration(): Promise<void> {
            expect(repositoryPolicyPlugin.policies.map(function toName(policy,) {
              return policy.name;
            },),).toContain('dependent-version-bump',);
            expect(dependentVersionBump.defaultSeverity,).toBe('error',);
            expect(dependentVersionBump.warnSafe,).toBe(false,);
            expect(dependentVersionBump.triggers,).toEqual(['pre-forward', 'direct-check', 'direct-fix',],);
          },
        },),
      ],
    },),
    describe({
      name: findDependentBumps.name,
      children: [
        it({
          name: 'patches runtime and bundled dependents of a hand bump and leaves others alone',
          fn: async function testBump(): Promise<void> {
            /**
             Repository fixture: base bumped; runtime dependent, bundled dev dependent, unbundled dev dependent, test-only importer.
             */
            const files = [
              configFile(['@s/base', '@s/runtime', '@s/bundled', '@s/unbundled', '@s/test-only',],),
              {
                path: 'package/module/base/package.json',
                text: manifestText({ name: '@s/base', version: '1.1.0', },),
                headText: manifestText({ name: '@s/base', version: '1.0.0', },),
              },
              unchangedManifest('package/module/runtime', { name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*', }, },),
              unchangedManifest('package/module/bundled', { name: '@s/bundled', version: '0.3.9', devDependencies: { '@s/base': 'workspace:*', }, },),
              { path: 'package/module/bundled/src/index.ts', text: "import { base } from '@s/base/ts';\n", headText: "import { base } from '@s/base/ts';\n", },
              unchangedManifest('package/module/unbundled', { name: '@s/unbundled', version: '1.0.0', devDependencies: { '@s/base': 'workspace:*', }, },),
              unchangedManifest('package/module/test-only', { name: '@s/test-only', version: '1.0.0', devDependencies: { '@s/base': 'workspace:*', }, },),
              { path: 'package/module/test-only/src/index.unit.test.ts', text: "import '@s/base';\n", headText: "import '@s/base';\n", },
            ];
            /**
             Findings for the fixture.
             */
            const findings = await findDependentBumps(contextOf(files,),);
            expect(findings.map(function toPath(finding,) {
              return finding.path;
            },),).toEqual([
              'package/module/bundled/package.json',
              'package/module/runtime/package.json',
            ],);
            expect(findings.every(function isStale(finding,) {
              return finding.code === DEPENDENT_VERSION_STALE_CODE;
            },),).toBe(true,);
            /**
             Patch for the runtime dependent.
             */
            const runtimePatch = findings[1]?.patch;
            expect(runtimePatch?.targetId,).toContain('tracked:',);
            expect(DECODER.decode(runtimePatch?.bytes,),).toContain('+  "version": "2.0.1"',);
          },
        },),
        it({
          name: 'stays silent for forwarded commands other than commit, such as git add of a hand bump',
          fn: async function testAddIgnored(): Promise<void> {
            /**
             Hand bump with a stale runtime dependent.
             */
            const files = [
              configFile(['@s/base', '@s/runtime',],),
              {
                path: 'package/module/base/package.json',
                text: manifestText({ name: '@s/base', version: '1.1.0', },),
                headText: manifestText({ name: '@s/base', version: '1.0.0', },),
              },
              unchangedManifest('package/module/runtime', { name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*', }, },),
            ];
            expect(
              await findDependentBumps(contextOf(files, false, 'add',),),
            ).toEqual([],);
            expect(
              (await findDependentBumps(contextOf(files,),)).length,
            ).toBe(1,);
          },
        },),
        it({
          name: 'proposes dependent bumps during direct fix',
          fn: async function testDirectFix(): Promise<void> {
            /**
             Worktree hand bump selected by the fix, with a stale runtime dependent.
             */
            const files = [
              configFile(['@s/base', '@s/runtime',],),
              {
                path: 'package/module/base/package.json',
                text: manifestText({ name: '@s/base', version: '1.1.0', },),
                headText: manifestText({ name: '@s/base', version: '1.0.0', },),
              },
              unchangedManifest('package/module/runtime', { name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*', }, },),
            ];
            /**
             Findings under the direct-fix trigger.
             */
            const findings = await findDependentBumps({
              ...contextOf(files,),
              trigger: 'direct-fix',
              command: {
                ...contextOf(files,).command,
                rawArgs: ['cli-git', 'fix',],
                transformedArgs: ['cli-git', 'fix',],
                subcommand: 'cli-git',
              },
            },);
            expect(findings.map(function toPath(finding,) {
              return finding.path;
            },),).toEqual(['package/module/runtime/package.json',],);
          },
        },),
        it({
          name: 'returns nothing when no manifest version changed',
          fn: async function testNoBump(): Promise<void> {
            /**
             Manifest changed without a version change.
             */
            const files = [
              configFile(['@s/base', '@s/runtime',],),
              {
                path: 'package/module/base/package.json',
                text: manifestText({ name: '@s/base', version: '1.0.0', description: 'x', },),
                headText: manifestText({ name: '@s/base', version: '1.0.0', },),
              },
              unchangedManifest('package/module/runtime', { name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*', }, },),
            ];
            expect(
              await findDependentBumps(contextOf(files,),),
            ).toEqual([],);
            expect(
              await findDependentBumps(contextOf([configFile([],),],),),
            ).toEqual([],);
          },
        },),
        it({
          name: 'settles once dependents are bumped',
          fn: async function testSettled(): Promise<void> {
            /**
             Base and its dependent both already bumped.
             */
            const files = [
              configFile(['@s/base', '@s/runtime',],),
              {
                path: 'package/module/base/package.json',
                text: manifestText({ name: '@s/base', version: '1.1.0', },),
                headText: manifestText({ name: '@s/base', version: '1.0.0', },),
              },
              {
                path: 'package/module/runtime/package.json',
                text: manifestText({ name: '@s/runtime', version: '2.0.1', dependencies: { '@s/base': 'workspace:*', }, },),
                headText: manifestText({ name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*', }, },),
              },
            ];
            expect(
              await findDependentBumps(contextOf(files,),),
            ).toEqual([],);
          },
        },),
        it({
          name: 'reports a dependent whose prerelease version cannot be bumped automatically',
          fn: async function testUnsupported(): Promise<void> {
            /**
             Dependent on a prerelease version.
             */
            const files = [
              configFile(['@s/base', '@s/runtime',],),
              {
                path: 'package/module/base/package.json',
                text: manifestText({ name: '@s/base', version: '1.1.0', },),
                headText: manifestText({ name: '@s/base', version: '1.0.0', },),
              },
              unchangedManifest('package/module/runtime', { name: '@s/runtime', version: '2.0.0-rc.1', dependencies: { '@s/base': 'workspace:*', }, },),
            ];
            /**
             Findings for the fixture.
             */
            const findings = await findDependentBumps(contextOf(files,),);
            expect(findings.map(function toCode(finding,) {
              return finding.code;
            },),).toEqual([DEPENDENT_VERSION_UNSUPPORTED_CODE,],);
            expect(findings[0]?.patch,).toBeUndefined();
          },
        },),
        it({
          name: 'ignores a bump when the pnpr config is absent',
          fn: async function testNoConfig(): Promise<void> {
            /**
             Bump without a generated config.
             */
            const files = [
              {
                path: 'package/module/base/package.json',
                text: manifestText({ name: '@s/base', version: '1.1.0', },),
                headText: manifestText({ name: '@s/base', version: '1.0.0', },),
              },
              unchangedManifest('package/module/runtime', { name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*', }, },),
            ];
            expect(
              await findDependentBumps(contextOf(files,),),
            ).toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: readPublishableNames.name,
      children: [
        it({
          name: 'reads the packages list and stops at the first non-item line',
          fn: async function testNames(): Promise<void> {
            expect(readPublishableNames("a: 1\n  packages:\n    - '@s/a'\n    - '@s/b'\n  other: x\n    - '@s/c'\n",),).toEqual(['@s/a', '@s/b',],);
            expect(readPublishableNames("packages:\n  - '@s/a'",),).toEqual(['@s/a',],);
            expect(readPublishableNames('no list here\n',),).toEqual([],);
            expect(readPublishableNames("packages:\n  - ''\n",),).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);

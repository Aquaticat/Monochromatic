/**
 * Forbidden-strings policy adapter tests.
 *
 * @module
 */
import {
  chmod,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { setTimeout as wait, } from 'node:timers/promises';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import * as v from 'valibot';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  ABSENT_GIT_VALUE,
  type CandidateFile,
  type PolicyContext,
} from '@monochromatic-dev/git-policy-api/ts';
import {
  ForbiddenStringsPluginError,
  forbiddenStringsPlugin,
  forbiddenStringsPolicy,
  parseScannerOutput,
  scanCandidates,
} from './index.ts';

/** Executable fixture mode. */
const EXECUTABLE_MODE = 0o755;
/** Node argv count for scanner plus one candidate. */
const EXPECTED_SCANNER_ARGUMENT_COUNT = 3;
/** Candidate bytes used by adapter tests. */
const CANDIDATE_BYTES = new TextEncoder().encode('first\nsecret\n',);

/** Disposable test directory. */
type TestDirectory = Readonly<{
  /** Absolute directory path. */
  path: string;
  /** Removes directory. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates disposable adapter directory.
 *
 * @returns disposable directory
 */
async function createTestDirectory(): Promise<TestDirectory> {
  /** Temporary root. */
  const path = await mkdtemp(join(tmpdir(), 'forbidden-strings-policy-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 * Creates executable scanner fixture.
 *
 * @param directory - fixture directory
 *
 * @param body - Node program body
 *
 * @returns executable path
 */
async function writeScanner({
  directory,
  body,
}: Readonly<{
  directory: string;
  body: string;
}>): Promise<string> {
  /** Scanner fixture path. */
  const path = join(directory, 'scanner.mjs',);
  await writeFile(path, `#!${process.execPath}\n${body}\n`,);
  await chmod(path, EXECUTABLE_MODE,);
  return path;
}

/**
 * Creates exact lazy policy candidate.
 *
 * @param path - repository-relative path
 *
 * @returns candidate fixture
 */
function candidate(path: string,): CandidateFile {
  return {
    targetId: `target:${path}`,
    path,
    revision: 'fixture',
    mode: 'regular',
    change: 'added',
    bytes: function bytes(): Promise<Uint8Array> {
      return Promise.resolve(CANDIDATE_BYTES,);
    },
  };
}

/**
 * Captures expected plugin error.
 *
 * @param operation - operation expected to reject
 *
 * @returns plugin infrastructure error
 */
async function capturePluginError(
  operation: () => Promise<unknown>,
): Promise<ForbiddenStringsPluginError> {
  try {
    await operation();
  }
  catch (error: unknown) {
    if (error instanceof ForbiddenStringsPluginError)
      return error;
    throw error;
  }
  throw new Error('Expected forbidden-strings plugin error.',);
}

await describe({
  name: 'forbidden-strings policy adapter',
  children: [
    it({
      name: 'declares inert warn-unsafe lifecycle policy',
      fn: async function testDefinition() {
        expect(forbiddenStringsPlugin.name,).toBe('forbidden-strings',);
        expect(forbiddenStringsPolicy.defaultSeverity,).toBe('error',);
        expect(forbiddenStringsPolicy.warnSafe,).toBe(false,);
        expect(forbiddenStringsPolicy.triggers,).toEqual([
          'pre-forward',
          'post-commit',
          'manual-push',
          'direct-check',
        ],);
        // The policy defaults to baseline-on: a git policy exists to catch
        // leaked credentials, so repositories must opt OUT, not in.
        expect(v.parse(
          nonNullishOrThrow(forbiddenStringsPolicy.options,),
          {},
        ),).toEqual({
          executable: 'forbidden-strings',
          builtinRules: true,
        },);
      },
    },),
    it({
      name: 'maps redacted scanner hit to original candidate',
      fn: async function testOutputMapping() {
        /** Exact materialized scanner path. */
        const scannerPath = '/tmp/plugin-owned/candidate-0';
        expect(parseScannerOutput({
          stderr: `${scannerPath}:2:1..6 rule=4`,
          candidateForPath: function candidateForPath(path,): CandidateFile {
            if (path !== scannerPath)
              throw new Error(`Unexpected scanner path: ${path}`,);
            return candidate('src/value.ts',);
          },
        },),).toEqual([{
          code: 'forbidden-string',
          message: 'Forbidden string matched at line 2, columns 1 to 6 (rule 4).',
          path: 'src/value.ts',
        },],);
      },
    },),
    it({
      name: 'rejects malformed and scanner infrastructure output',
      fn: async function testMalformedOutput() {
        const malformed = await capturePluginError(async function parseMalformed() {
          parseScannerOutput({ stderr: 'not-a-hit', candidateForPath: function noCandidate(): never {
            throw new Error('Candidate lookup must not run.',);
          }, },);
        },);
        expect(malformed.message,).toContain('Malformed',);
        const readFailure = await capturePluginError(async function parseReadFailure() {
          parseScannerOutput({
            stderr: '/tmp/candidate: read error: denied',
            candidateForPath: function noCandidate(): never {
              throw new Error('Candidate lookup must not run.',);
            },
          },);
        },);
        expect(readFailure.message,).toContain('infrastructure failure',);
      },
    },),
    it({
      name: 'invokes scanner without shell interpolation and parses finding',
      fn: async function testScannerInvocation() {
        await using directory = await createTestDirectory();
        const scanner = await writeScanner({
          directory: directory.path,
          body: `process.stderr.write(process.argv[2] + ':2:1..6 rule=1\\n'); process.exitCode = 1;`,
        },);
        const findings = await scanCandidates({
          executable: scanner,
          builtinRules: false,
          repositoryRoot: directory.path,
          candidates: [candidate('name;not-a-command',),],
          signal: new AbortController().signal,
        },);
        expect(findings,).toEqual([{
          code: 'forbidden-string',
          message: 'Forbidden string matched at line 2, columns 1 to 6 (rule 1).',
          path: 'name;not-a-command',
        },],);
      },
    },),
    it({
      name: 'materializes only landed-delta candidates after commit',
      fn: async function testPostCommitDelta() {
        await using directory = await createTestDirectory();
        /** Scanner requiring exactly one retained candidate path. */
        const scanner = await writeScanner({
          directory: directory.path,
          body: `if (process.argv.length !== ${String(EXPECTED_SCANNER_ARGUMENT_COUNT,)}) { process.stderr.write('unexpected candidate count'); process.exitCode = 2; }`,
        },);
        /** Unchanged candidate whose bytes must remain unread. */
        const unchanged: CandidateFile = {
          ...candidate('stable.txt',),
          change: 'unchanged',
          bytes: function rejectUnchangedRead(): Promise<Uint8Array> {
            throw new Error('Unchanged landed candidate was read.',);
          },
        };
        /** Changed candidate retained for scanner. */
        const changed = candidate('changed.txt',);
        /** Post-commit policy context over complete landed tree. */
        const context: PolicyContext = {
          candidateVersion: 0,
          trigger: 'post-commit',
          command: {
            rawArgs: ['commit',],
            transformedArgs: ['commit',],
            subcommand: 'commit',
            effectiveCwd: directory.path,
            repositoryRoot: directory.path,
            escapedPolicyIds: new Set(),
          },
          git: {
            candidates: function candidates() { return Promise.resolve([unchanged, changed,],); },
            headOid: function headOid() { return Promise.resolve(ABSENT_GIT_VALUE,); },
            landedCommitOid: function landedCommitOid() { return Promise.resolve('landed',); },
            pushUpdates: function pushUpdates() { return Promise.resolve([],); },
          },
          signal: new AbortController().signal,
        };
        expect(await forbiddenStringsPolicy.check({
          context,
          options: {
            executable: scanner,
            builtinRules: false,
          },
        },),).toEqual([],);
      },
    },),
    it({
      name: 'preserves scanner walker exclusions for materialized candidates',
      fn: async function testScannerWalkerExclusions() {
        await using directory = await createTestDirectory();
        /** Scanner requiring exactly three retained candidate arguments. */
        const scanner = await writeScanner({
          directory: directory.path,
          body: `if (process.argv.length !== 5) { process.stderr.write('unexpected candidate count'); process.exitCode = 2; }`,
        },);
        /** Paths scanner excludes only at canonical repository locations. */
        const excludedPaths = [
          'forbidden-strings.local.txt',
          'packages/cli/forbidden-strings/data/betterleaks-default-config.toml',
          'packages/cli/forbidden-strings/data/builtin-rules.txt',
          'packages/cli/forbidden-strings/src/port-betterleaks-relaxations.ts',
          'packages/cli/forbidden-strings/src/rules/algebra_tests.rs',
        ] as const;
        /** Candidates whose bytes must remain unread. */
        const excludedCandidates = excludedPaths.map(function excludedCandidate(path,): CandidateFile {
          return {
            ...candidate(path,),
            bytes: function rejectExcludedRead(): Promise<Uint8Array> {
              throw new Error(`Scanner-excluded candidate was read: ${path}`,);
            },
          };
        },);
        /** Same basename outside canonical location must remain scannable, and
         * the retired root example path is ordinary scannable content now that
         * the baseline lives inside the scanner package. */
        const retainedCandidates = [
          candidate('nested/forbidden-strings.local.example.txt',),
          candidate('forbidden-strings.local.example.txt',),
          candidate('src/value.ts',),
        ];
        // The cwd-default exclusion only applies when no env override
        // exists; the repo's mise env sets one, so the test injects an
        // empty environment instead of mutating shared global state.
        expect(await scanCandidates({
          executable: scanner,
          builtinRules: false,
          repositoryRoot: directory.path,
          environment: {},
          candidates: [
            ...excludedCandidates,
            ...retainedCandidates,
          ],
          signal: new AbortController().signal,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'excludes env-configured rules path inside repository',
      fn: async function testEnvConfiguredRulesExclusion() {
        await using directory = await createTestDirectory();
        /** Scanner requiring exactly one retained candidate argument. */
        const scanner = await writeScanner({
          directory: directory.path,
          body: `if (process.argv.length !== 3) { process.stderr.write('unexpected candidate count'); process.exitCode = 2; }`,
        },);
        /** Env-configured rules file whose bytes must remain unread. */
        const excludedRules: CandidateFile = {
          ...candidate('.cache/forbidden-strings.rules.txt',),
          bytes: function rejectRulesRead(): Promise<Uint8Array> {
            throw new Error('Env-configured rules candidate was read.',);
          },
        };
        expect(await scanCandidates({
          executable: scanner,
          builtinRules: false,
          repositoryRoot: directory.path,
          environment: { FORBIDDEN_STRINGS_RULES: '.cache/forbidden-strings.rules.txt', },
          candidates: [
            excludedRules,
            candidate('src/value.ts',),
          ],
          signal: new AbortController().signal,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'classifies missing executable and scanner status separately',
      fn: async function testProcessFailures() {
        await using directory = await createTestDirectory();
        const missing = await capturePluginError(async function runMissing() {
          await scanCandidates({
            executable: join(directory.path, 'missing',),
            builtinRules: false,
            repositoryRoot: directory.path,
            candidates: [candidate('file.txt',),],
            signal: new AbortController().signal,
          },);
        },);
        expect(missing.message,).toContain('could not be started',);
        const scanner = await writeScanner({
          directory: directory.path,
          body: 'process.exitCode = 2;',
        },);
        const status = await capturePluginError(async function runFailedScanner() {
          await scanCandidates({
            executable: scanner,
            builtinRules: false,
            repositoryRoot: directory.path,
            candidates: [candidate('file.txt',),],
            signal: new AbortController().signal,
          },);
        },);
        expect(status.message,).toContain('status 2',);
      },
    },),
    it({
      name: 'deduplicates historical content and bounds materialization concurrency',
      fn: async function testBoundedMaterialization() {
        await using directory = await createTestDirectory();
        const scanner = await writeScanner({
          directory: directory.path,
          body: 'process.exitCode = 0;',
        },);
        /** Number of distinct scanner identities. */
        const candidateCount = 128;
        /** Delay keeping candidate reads concurrently observable. */
        const readDelayMilliseconds = 10;
        /** Mutable activity observed only by this sequential test. */
        const activity = {
          active: 0,
          peak: 0,
          calls: 0,
        };
        /** Distinct candidates followed by scanner-equivalent duplicates. */
        const candidates = Array.from(
          { length: candidateCount, },
          function createCandidate(_unused, index,): readonly CandidateFile[] {
            /** Shared scanner-equivalent candidate fields. */
            const fields = {
              path: `candidate-${String(index,)}.txt`,
              revision: `revision-${String(index,)}`,
              mode: 'regular',
              change: 'added',
            } as const;
            /** First retained candidate with observable lazy bytes. */
            const first: CandidateFile = {
              ...fields,
              targetId: `first-${String(index,)}`,
              async bytes(): Promise<Uint8Array> {
                activity.active += 1;
                activity.calls += 1;
                activity.peak = Math.max(
                  activity.peak,
                  activity.active,
                );
                await wait(readDelayMilliseconds,);
                activity.active -= 1;
                return CANDIDATE_BYTES;
              },
            };
            /** Duplicate that must never load bytes. */
            const duplicate: CandidateFile = {
              ...fields,
              targetId: `duplicate-${String(index,)}`,
              bytes: function rejectDuplicateRead(): Promise<Uint8Array> {
                throw new Error('Scanner-equivalent duplicate bytes were loaded.',);
              },
            };
            return [
              first,
              duplicate,
            ];
          },
        ).flat();
        expect(await scanCandidates({
          executable: scanner,
          builtinRules: false,
          repositoryRoot: directory.path,
          candidates,
          signal: new AbortController().signal,
        },),).toEqual([],);
        expect(activity.calls,).toBe(candidateCount,);
        expect(activity.peak,).toBe(64,);
      },
    },),
    it({
      name: 'passes opt-in builtin-rules flag before candidate positionals',
      fn: async function testBuiltinRulesFlag() {
        await using directory = await createTestDirectory();
        /** Scanner requiring the flag as its first argument. */
        const scanner = await writeScanner({
          directory: directory.path,
          body: `if (process.argv[2] !== '--builtin-rules' || process.argv.length !== 4) { process.stderr.write('missing builtin-rules flag'); process.exitCode = 2; }`,
        },);
        expect(await scanCandidates({
          executable: scanner,
          builtinRules: true,
          repositoryRoot: directory.path,
          candidates: [candidate('src/value.ts',),],
          signal: new AbortController().signal,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'does not invoke scanner for contentless candidates',
      fn: async function testContentless() {
        await using directory = await createTestDirectory();
        expect(await scanCandidates({
          executable: join(directory.path, 'missing',),
          builtinRules: false,
          repositoryRoot: directory.path,
          candidates: [],
          signal: new AbortController().signal,
        },),).toEqual([],);
      },
    },),
  ],
},);

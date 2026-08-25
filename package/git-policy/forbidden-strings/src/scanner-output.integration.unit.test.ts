/**
 * Redacted parser coverage over the real forbidden-strings scanner binary.
 *
 * @module
 */
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { parseScannerOutput, } from '@monochromatic-dev/git-policy-forbidden-strings';

/** Candidate type owned by built parser interface under test. */
type CandidateFile = ReturnType<Parameters<typeof parseScannerOutput>[0]['candidateForPath']>;

/**
 * Release scanner built by the sibling `package/cli/forbidden-strings` crate;
 * the same binary the repository commit gate executes, so its stderr is the
 * exact contract this parser consumes.
 */
const SCANNER_BINARY = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'cli',
  'forbidden-strings',
  'target',
  'release',
  'forbidden-strings',
);
/**
 * Repository-relative path the parser echoes back for the reported candidate.
 */
const CANDIDATE_PATH = 'src/secret.ts';
/**
 * Secret-shaped scanner input: an AWS-shaped access key spelled with `\u00XX`
 * escapes for its recognizable prefix and its final byte, so the committed
 * source never holds a complete access-key literal while the decoded runtime
 * bytes still trip the scanner's embedded baseline.
 */
const SECRET_SHAPED_TOKEN = '\u0041\u004B\u0049\u0041IOSFODNN7EXAM\u0050LE';
/**
 * Fixed redacted-message prefix preceding the one-based line number.
 */
const MESSAGE_PREFIX = 'Forbidden string matched at line ';
/**
 * Fixed redacted-message infix introducing the opaque rule index.
 */
const MESSAGE_RULE_INFIX = ' (rule ';
/**
 * Fixed redacted-message suffix closing the rule index.
 */
const MESSAGE_SUFFIX = ').';
/**
 * Scanner match exit status; a nonzero status carries findings on stderr.
 */
const MATCH_EXIT_CODE = 1;

/**
 * Disposable scan-input directory.
 */
type TestDirectory = Readonly<{
  /**
   * Absolute directory path.
   */
  path: string;
  /**
   * Removes directory.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates a disposable directory for one real scan.
 *
 * @returns disposable directory
 */
async function createTestDirectory(): Promise<TestDirectory> {
  /**
   * Temporary root.
   */
  const path = await mkdtemp(join(tmpdir(), 'forbidden-strings-real-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 * Runs the real scanner over one materialized candidate and returns its stderr.
 *
 * @param candidatePath - materialized scanner input path
 *
 * @param cwd - scanner working directory
 *
 * @returns captured redacted scanner stderr
 *
 * @throws When the scanner reports no match or an infrastructure status.
 */
async function captureRealScannerStderr({
  candidatePath,
  cwd,
}: Readonly<{
  candidatePath: string;
  cwd: string;
}>): Promise<string> {
  /**
   * Environment without the repository rules override so the scan stays
   * hermetic under the crate's embedded baseline only.
   */
  const environment = { ...process.env, };
  delete environment.FORBIDDEN_STRINGS_RULES;
  try {
    await nanoSpawn(
      SCANNER_BINARY,
      [
        '--builtin-rules',
        candidatePath,
      ],
      {
        cwd,
        env: environment,
      },
    );
  }
  catch (error: unknown) {
    if (!(error instanceof SubprocessError))
      throw error;
    if (error.exitCode !== MATCH_EXIT_CODE)
      throw new Error(
        `Real forbidden-strings scanner exited with unexpected status ${String(error.exitCode,)}.`,
        { cause: error, },
      );
    return error.stderr;
  }
  throw new Error('Real forbidden-strings scanner did not report the seeded secret.',);
}

/**
 * Runs real scanner through runtime cache miss and returns warning plus finding stderr.
 *
 * @param candidatePath - Materialized scanner input path.
 *
 * @param rulesPath - Authoritative runtime rules path.
 *
 * @param cacheRoot - Disposable cache root forced empty by test directory.
 *
 * @param cwd - Scanner working directory.
 *
 * @returns Captured mixed-protocol stderr from match exit.
 */
async function captureRuntimeCacheMissStderr({
  candidatePath,
  rulesPath,
  cacheRoot,
  cwd,
}: Readonly<{
  candidatePath: string;
  rulesPath: string;
  cacheRoot: string;
  cwd: string;
}>,): Promise<string> {
  /**
   * Environment isolating runtime cache and repository-level rules override.
   */
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    FORBIDDEN_STRINGS_CACHE_DIR: cacheRoot,
  };
  delete environment.FORBIDDEN_STRINGS_RULES;
  try {
    await nanoSpawn(
      SCANNER_BINARY,
      [
        '--rules',
        rulesPath,
        candidatePath,
      ],
      {
        cwd,
        env: environment,
      },
    );
  }
  catch (error: unknown) {
    if (!(error instanceof SubprocessError))
      throw error;
    if (error.exitCode !== MATCH_EXIT_CODE)
      throw new Error(
        `Real forbidden-strings scanner exited with unexpected status ${String(error.exitCode,)}.`,
        { cause: error, },
      );
    return error.stderr;
  }
  throw new Error('Real forbidden-strings scanner did not report runtime-rule match.',);
}

await describe({
  name: 'forbidden-strings redacted parser over real scanner output',
  children: [
    it({
      name: 'maps real columnless scanner stderr to a redacted finding',
      fn: async function testRealScannerOutput() {
        await using directory = await createTestDirectory();
        /**
         * Materialized scanner input holding the runtime secret.
         */
        const candidatePath = join(directory.path, 'candidate-0',);
        await writeFile(
          candidatePath,
          `alpha\nkey ${SECRET_SHAPED_TOKEN} tail\n`,
        );
        /**
         * Findings parsed from the real binary's own stderr.
         */
        const findings = parseScannerOutput({
          stderr: await captureRealScannerStderr({
            candidatePath,
            cwd: directory.path,
          },),
          candidateForPath: function candidateForPath(path,): CandidateFile {
            if (path !== candidatePath)
              throw new Error(`Unexpected scanner path: ${path}`,);
            return {
              targetId: `target:${CANDIDATE_PATH}`,
              path: CANDIDATE_PATH,
              revision: 'fixture',
              mode: 'regular',
              change: 'added',
              bytes: function bytes(): Promise<Uint8Array> {
                return Promise.resolve(new Uint8Array(),);
              },
            };
          },
        },);
        expect(findings.length,).toBeGreaterThan(0,);
        for (const finding of findings) {
          expect(finding.code,).toBe('forbidden-string',);
          expect(finding.path,).toBe(CANDIDATE_PATH,);
          expect(finding.message.startsWith(MESSAGE_PREFIX,),).toBe(true,);
          expect(finding.message.includes(MESSAGE_RULE_INFIX,),).toBe(true,);
          expect(finding.message.endsWith(MESSAGE_SUFFIX,),).toBe(true,);
          expect(finding.message.includes('column',),).toBe(false,);
          expect(finding.message.includes(SECRET_SHAPED_TOKEN,),).toBe(false,);
        }
      },
    },),
    it({
      name: 'ignores real cache warning while mapping runtime-rule finding',
      fn: async function testRealRuntimeCacheWarning() {
        await using directory = await createTestDirectory();
        /**
         * Authoritative one-rule runtime source.
         */
        const rulesPath = join(directory.path, 'rules.txt',);
        /**
         * Candidate containing exact runtime rule literal.
         */
        const candidatePath = join(directory.path, 'candidate-runtime',);
        /**
         * Empty disposable cache root forcing missing warning.
         */
        const cacheRoot = join(directory.path, 'cache',);
        await writeFile(rulesPath, 'RUNTIME_CACHE_RULE_LONG\n',);
        await writeFile(candidatePath, 'RUNTIME_CACHE_RULE_LONG\n',);
        const stderr = await captureRuntimeCacheMissStderr({
          candidatePath,
          rulesPath,
          cacheRoot,
          cwd: directory.path,
        },);
        expect(stderr,).toContain('"type":"forbidden-strings/cache-warning"',);
        expect(parseScannerOutput({
          stderr,
          candidateForPath: function candidateForPath(path,): CandidateFile {
            if (path !== candidatePath)
              throw new Error(`Unexpected scanner path: ${path}`,);
            return {
              targetId: `target:${CANDIDATE_PATH}`,
              path: CANDIDATE_PATH,
              revision: 'fixture',
              mode: 'regular',
              change: 'added',
              bytes: function bytes(): Promise<Uint8Array> {
                return Promise.resolve(new Uint8Array(),);
              },
            };
          },
        },),).toEqual([{
          code: 'forbidden-string',
          message: 'Forbidden string matched at line 1 (rule 0).',
          path: CANDIDATE_PATH,
        },],);
      },
    },),
  ],
},);

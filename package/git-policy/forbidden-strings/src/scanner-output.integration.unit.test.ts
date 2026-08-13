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
import type { CandidateFile, } from '@monochromatic-dev/git-policy-api/ts';
import { parseScannerOutput, } from './scanner-output.ts';

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

await describe({
  name: 'forbidden-strings redacted parser over real scanner output',
  children: [
    it({
      name: 'maps real scanner stderr, column span and all, to a redacted '
        + 'finding. This test invokes the actual binary precisely so the '
        + 'parser cannot drift from it, and it was RED before the span was '
        + 'handled, failing with the same Malformed error that blocked pushes',
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
          // The scanner DOES report a column span, and this assertion used to
          // demand its absence. forbidden-strings 0.1.9 writes
          // `path:LINE:START..END rule=N` for baseline rules as much as for
          // user rules, so the parser was rejecting every real hit as
          // malformed and this test failed with that very error. Requiring the
          // span here keeps the fixture honest about the tool it invokes.
          expect(finding.message.includes(' columns ',),).toBe(true,);
          expect(finding.message.includes(SECRET_SHAPED_TOKEN,),).toBe(false,);
        }
      },
    },),
  ],
},);

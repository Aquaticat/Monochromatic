/**
 * Destination-grammar validation for engine-owned Git patches.
 *
 * @module
 */
import type {
  GitObjectId,
  PolicyPatch,
} from '../api/policy-types.ts';

/**
 * Strict patch decoder.
 */
const PATCH_DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 * Directives outside tracer's ordinary single-path text contract.
 */
const FORBIDDEN_PATCH_PREFIXES: readonly string[] = [
  'rename from ',
  'rename to ',
  'copy from ',
  'copy to ',
  'new file mode ',
  'deleted file mode ',
  'GIT binary patch',
  'Binary files ',
];

/**
 * Validates policy bytes against exact supported Git patch grammar.
 *
 * @param patch - untrusted policy patch proposal
 *
 * @param expectedRevision - exact candidate blob revision
 *
 * @throws TypeError for path injection or unsupported directives
 *
 * @example
 * ```ts
 * validatePolicyPatch({ patch, expectedRevision: 'abc' });
 * ```
 */
export function validatePolicyPatch({
  patch,
  expectedRevision,
}: Readonly<{
  patch: PolicyPatch;
  expectedRevision: GitObjectId;
}>,): void {
  if (patch.path
    .includes('\n',)
    || patch.path
    .includes('\r',))
    throw new TypeError('Patch path contains an unsupported line delimiter.',);
  /**
   * Required single-path patch header.
   */
  const requiredHeader = `diff --git a/${patch.path} b/${patch.path}`;
  /**
   * Required old-file header.
   */
  const requiredOldHeader = `--- a/${patch.path}`;
  /**
   * Required new-file header.
   */
  const requiredNewHeader = `+++ b/${patch.path}`;
  /**
   * Decoded patch lines for destination-grammar validation.
   */
  const lines = PATCH_DECODER.decode(patch.bytes,)
    .split('\n',);
  /**
   * Required candidate-base index header prefix.
   */
  const requiredIndexPrefix = `index ${expectedRevision}..`;
  /**
   * Index header lines supplied by policy.
   */
  const indexHeaders = lines.filter(function indexHeader(line,) {
    return line.startsWith('index ',);
  },);
  /**
   * Header counts proving exactly one declared target.
   */
  const requiredCounts = [
    requiredHeader,
    requiredOldHeader,
    requiredNewHeader,
  ]
    .map(function countHeader(header,) {
      return lines.filter(function matches(line,) {
        return line === header;
      },)
        .length;
    },);
  /**
   * Sole index header when structurally present.
   */
  const [indexHeader,] = indexHeaders;
  if ((lines[0] !== requiredHeader)
    || requiredCounts.some(function isNotOne(count,) { return count !== 1; },)
    || (indexHeaders.length !== 1)
    || (indexHeader === undefined)
    || (!indexHeader.startsWith(requiredIndexPrefix,))
    || lines.some(function mismatchedPathDirective(line,) {
      return (line.startsWith('diff --git ',) && (line !== requiredHeader))
        || (line.startsWith('--- ',) && (line !== requiredOldHeader))
        || (line.startsWith('+++ ',) && (line !== requiredNewHeader));
    },)
    || lines.some(function forbiddenDirective(line,) {
      return FORBIDDEN_PATCH_PREFIXES.some(function startsDirective(prefix,) {
        return line.startsWith(prefix,);
      },);
    },))
    throw new TypeError(`Patch must contain exactly declared ordinary text path ${patch.path}`,);
}

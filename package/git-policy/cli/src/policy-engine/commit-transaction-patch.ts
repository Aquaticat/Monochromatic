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
  'old mode ',
  'new mode ',
  'GIT binary patch',
  'Binary files ',
];

/**
 * Tests bounded Git object ID hexadecimal grammar.
 *
 * @param value - object ID candidate
 *
 * @returns whether every code unit belongs to lowercase hexadecimal alphabet
 */
function isLowercaseHexadecimal(value: string,): boolean {
  /**
   * Git hexadecimal alphabet.
   */
  const hexadecimal = '0123456789abcdef';
  for (let index = 0; index < value.length; index += 1) {
    if (!hexadecimal.includes(value.charAt(index,),))
      return false;
  }
  return true;
}

/**
 * Validates exact ordinary-text index header.
 *
 * @param line - sole index header
 *
 * @param expectedRevision - exact candidate blob revision
 *
 * @returns whether object IDs and mode are bounded ordinary text values
 */
function isValidIndexHeader({
  line,
  expectedRevision,
}: Readonly<{
  line: string;
  expectedRevision: GitObjectId;
}>,): boolean {
  /**
   * Header fields after stable directive prefix.
   */
  const fields = line.slice('index '.length,)
    .split(' ',);
  if (fields.length !== 2)
    return false;
  /**
   * Object range and ordinary file mode.
   */
  const [range, mode,] = fields;
  if ((range === undefined) || (mode === undefined)
    || ((mode !== '100644') && (mode !== '100755')))
    return false;
  /**
   * Exact old/new object delimiter.
   */
  const delimiter = range.indexOf('..',);
  if ((delimiter === (-1)) || range.includes(
    '..',
    delimiter + 2,
  ))
    return false;
  /**
   * Candidate base object ID.
   */
  const oldRevision = range.slice(
    0,
    delimiter,
  );
  /**
   * Proposed object ID placeholder.
   */
  const newRevision = range.slice(delimiter + 2,);
  return (oldRevision === expectedRevision)
    && (newRevision.length === expectedRevision.length)
    && isLowercaseHexadecimal(newRevision,);
}

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
  /**
   * Repository path segments validated before destination interpolation.
   */
  const pathSegments = patch.path
    .split('/',);
  if (patch.path
    .includes('\n',)
    || patch.path
    .includes('\r',)
    || patch.path
    .startsWith('/',)
    || pathSegments.some(function traversalSegment(segment,) {
      return (segment === '..') || (segment === '.');
    },))
    throw new TypeError('Patch path contains an unsupported delimiter or traversal segment.',);
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
    || (!isValidIndexHeader({
      line: indexHeader,
      expectedRevision,
    },))
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

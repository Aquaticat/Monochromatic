/**
 * Differential parser oracle: decode one TOML document with our decoder and the
 * pinned BurntSushi reference decoder, then classify the pair of verdicts.
 *
 * Our side runs in-process (`parseTomlEdit` from the built package entry, then
 * the `conformance` tagger), so the parser under test is exercised across the
 * build boundary without a per-case `node` spawn. The reference side spawns the
 * Go `toml-test-decoder` binary, which reads TOML on stdin and prints tagged
 * JSON, exiting non-zero for invalid input. The binary is pinned in the package
 * `mise.toml` `[tools]` and resolved once via `mise which`; a missing binary is
 * a loud failure, not a silent skip, because running it is the whole point.
 *
 * @module
 */

import {
  execFileSync,
} from 'node:child_process';
import {
  existsSync,
} from 'node:fs';

import {
  parseTomlEdit,
} from '@monochromatic-dev/module-toml-edit';

import {
  documentToTagged,
} from '../conformance/decode-to-tagged.ts';
import type {
  TaggedTree,
} from '../conformance/tagged-types.ts';
import {
  taggedSemanticEquals,
} from './differential-compare.ts';

/**
 * Verdict of our in-process decoder for one document.
 */
export type OurVerdict =
  | {
    readonly accepted: true;
    readonly tagged: TaggedTree
  }
  | {
    readonly accepted: false;
    readonly reason: string
  };

/**
 * Verdict of the reference decoder for one document. Its tagged output is
 * untyped parsed JSON, compared structurally by the semantic comparator.
 */
export type ReferenceVerdict =
  | {
    readonly accepted: true;
    readonly tagged: unknown
  }
  | { readonly accepted: false; };

/**
 * Classification of one document's verdict pair.
 *
 * `diverge-we-lax` and `diverge-value` are defects to fix; `diverge-we-strict`
 * is logged because matching a reference laxity would loosen our parser;
 * `diverge-reference-empty-key` is logged because it is a proven reference
 * decoder bug, not ours (see {@link arrayHoldsEmptyKeyedTable}).
 */
export type DifferentialClass =
  | 'agree-reject'
  | 'agree-accept'
  | 'diverge-value'
  | 'diverge-we-lax'
  | 'diverge-we-strict'
  | 'diverge-reference-empty-key';

/**
 * Full differential result: the classification plus both verdicts and the input
 * that produced them, so a counterexample is self-contained.
 */
export type DifferentialResult = {
  readonly kind: DifferentialClass;
  readonly toml: string;
  readonly ours: OurVerdict;
  readonly reference: ReferenceVerdict;
};

/**
 * Cache holding the resolved reference decoder path, so the fallback `mise which`
 * subprocess runs at most once. A `Map` keyed by a constant rather than a
 * module-level `let`, per the no-module-root-`let` convention.
 */
const decoderPathCache = new Map<string, string>();

/**
 * Single cache key for the resolved decoder path.
 */
const DECODER_PATH_CACHE_KEY = 'reference-decoder-path';

/**
 * Locate the reference decoder binary.
 *
 * Prefers `TOML_EDIT_REF_DECODER` (set by the `test:differential` task), then
 * falls back to resolving the pinned `[tools]` entry through `mise which`.
 *
 * @returns Absolute path to the `toml-test-decoder` binary.
 *
 * @throws Error when the binary cannot be located, naming the task that
 *         acquires it, so an absent tool fails loud.
 *
 * @example
 * ```ts
 * locateReferenceDecoder(); // '/.../bin/toml-test-decoder'
 * ```
 */
function locateReferenceDecoder(): string {
  /**
   * Decoder path supplied by the task environment, if any.
   */
  const fromEnv = process.env
    .TOML_EDIT_REF_DECODER;
  if ((fromEnv !== undefined) && (fromEnv !== '')) {
    if (!existsSync(fromEnv,))
      throw new Error(`reference decoder not found at TOML_EDIT_REF_DECODER=${fromEnv}`,);
    return fromEnv;
  }
  try {
    /**
     * Decoder path resolved through `mise which`.
     */
    const resolved = execFileSync(
      'mise',
      [
        'which',
        'toml-test-decoder',
      ],
      { encoding: 'utf8', },
    )
      .trim();
    if ((resolved === '') || (!existsSync(resolved,)))
      throw new Error('mise could not resolve toml-test-decoder',);
    return resolved;
  }
  catch (caught: unknown) {
    throw new Error(
      'reference decoder unavailable; run via `mise run //packages/module/toml-edit:test:differential` so the pinned go: tool is acquired',
      { cause: caught, },
    );
  }
}

/**
 * Resolve the reference decoder path, memoizing the first result.
 *
 * @returns Absolute path to the `toml-test-decoder` binary.
 *
 * @example
 * ```ts
 * referenceDecoderPath(); // '/.../bin/toml-test-decoder'
 * ```
 */
function referenceDecoderPath(): string {
  /**
   * Previously resolved decoder path, if cached.
   */
  const cached = decoderPathCache.get(DECODER_PATH_CACHE_KEY,);
  if (cached !== undefined)
    return cached;
  /**
   * Freshly located decoder path.
   */
  const resolved = locateReferenceDecoder();
  decoderPathCache.set(
    DECODER_PATH_CACHE_KEY,
    resolved,
  );
  return resolved;
}

/**
 * Whether a caught child-process error carries a numeric exit status, meaning
 * the process ran and exited non-zero (an invalid-TOML reject) rather than
 * failing to spawn.
 *
 * @param caught - Value thrown by `execFileSync`.
 *
 * @returns Whether the error represents a non-zero exit.
 *
 * @example
 * ```ts
 * hasNumericExitStatus({ status: 1, }); // true
 * ```
 */
function hasNumericExitStatus(caught: unknown,): boolean {
  return ((typeof caught) === 'object') && (caught !== null)
    && ((typeof (caught as { readonly status?: unknown; }).status) === 'number');
}

/**
 * Decode a document with the reference decoder.
 *
 * @param toml - TOML source.
 *
 * @returns Reference verdict, accepting with parsed tagged JSON or rejecting on
 *          a non-zero exit.
 *
 * @throws Error when the decoder fails to spawn or prints unparseable output, so
 *         a tooling failure is never mistaken for a reject.
 *
 * @example
 * ```ts
 * decodeReference({ toml: 'a = 1\n', }); // { accepted: true, tagged: { a: { type: 'integer', value: '1' } } }
 * ```
 */
function decodeReference({ toml, }: { readonly toml: string; },): ReferenceVerdict {
  try {
    return {
      accepted: true,
      tagged: JSON.parse(
        execFileSync(
          referenceDecoderPath(),
          [],
          {
            input: toml,
            encoding: 'utf8',
          },
        ),
      ),
    };
  }
  catch (caught: unknown) {
    if (hasNumericExitStatus(caught,))
      return { accepted: false, };
    throw new Error(
      'reference decoder failed to run or returned unusable output',
      { cause: caught, },
    );
  }
}

/**
 * Decode a document with our in-process decoder, pinned to TOML 1.0 to match the
 * reference decoder's grammar.
 *
 * @param toml - TOML source.
 *
 * @returns Our verdict, accepting with the tagged tree or rejecting with the
 *          parser diagnostic.
 *
 * @example
 * ```ts
 * decodeOurs({ toml: 'a = 1\n', }); // { accepted: true, tagged: { a: { type: 'integer', value: '1' } } }
 * ```
 */
function decodeOurs({ toml, }: { readonly toml: string; },): OurVerdict {
  try {
    return {
      accepted: true,
      tagged: documentToTagged({
        program: parseTomlEdit({
          source: toml,
          tomlVersion: '1.0',
        },)
          .program,
      },),
    };
  }
  catch (caught: unknown) {
    return {
      accepted: false,
      reason: String(caught,),
    };
  }
}

/**
 * Narrow an unknown value to a non-array object.
 *
 * @param value - Candidate tagged-tree node.
 *
 * @returns Whether `value` is a plain object.
 *
 * @example
 * ```ts
 * isPlainObject({ a: 1, }); // true
 * ```
 */
function isPlainObject(value: unknown,): value is Record<string, unknown> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Whether a tagged tree contains an array that directly holds an inline table
 * with an empty key.
 *
 * This is the shape the reference decoder's tagged output mis-handles: on
 * `[ { "" = 1 }, "z" ]` it drops `"z"`, and on `[ [ { "" = 1 } ] ]` it collapses
 * a nesting level, while our parser keeps both (a single-element
 * `[ { "" = 1 } ]` and an empty key outside an array both agree). The exact
 * fault may lie in the reference parser or in its JSON marshaling of an
 * empty-string key; either way the reference is not a trustworthy oracle for
 * this shape, so a divergence here is logged rather than treated as our defect.
 *
 * @param tree - Tagged tree from our (correct) decoder.
 *
 * @returns Whether some array in the tree directly holds an empty-keyed table.
 *
 * @example
 * ```ts
 * arrayHoldsEmptyKeyedTable([{ '': { type: 'integer', value: '1', }, },]); // true
 * ```
 */
function arrayHoldsEmptyKeyedTable(tree: unknown,): boolean {
  if (Array.isArray(tree,)) {
    if (tree.some(function holdsEmptyKeyedTable(element,) {
      return isPlainObject(element,) && Object.hasOwn(
        element,
        '',
      );
    },))
      return true;
    return tree.some(function recurseElement(element,) {
      return arrayHoldsEmptyKeyedTable(element,);
    },);
  }
  if (isPlainObject(tree,))
    return Object.values(tree,)
      .some(function recurseValue(value,) {
      return arrayHoldsEmptyKeyedTable(value,);
    },);
  return false;
}

/**
 * Classify a verdict pair.
 *
 * @param ours - Our verdict.
 *
 * @param reference - Reference verdict.
 *
 * @returns Differential class for the pair.
 *
 * @example
 * ```ts
 * classifyVerdicts({ ours: { accepted: false, reason: 'x', }, reference: { accepted: false, }, }); // 'agree-reject'
 * ```
 */
function classifyVerdicts(
  {
    ours,
    reference,
  }: {
    readonly ours: OurVerdict;
    readonly reference: ReferenceVerdict;
  },
): DifferentialClass {
  if (ours.accepted && reference.accepted) {
    if (taggedSemanticEquals({
      ours: ours.tagged,
      reference: reference.tagged,
    },))
      return 'agree-accept';
    if (arrayHoldsEmptyKeyedTable(ours.tagged,))
      return 'diverge-reference-empty-key';
    return 'diverge-value';
  }
  if (ours.accepted && (!reference.accepted))
    return 'diverge-we-lax';
  if ((!ours.accepted) && reference.accepted)
    return 'diverge-we-strict';
  return 'agree-reject';
}

/**
 * Run the full differential check for one document.
 *
 * @param toml - TOML source.
 *
 * @returns Differential result carrying the classification and both verdicts.
 *
 * @example
 * ```ts
 * classifyDifferential({ toml: 'a = 1\n', }).kind; // 'agree-accept'
 * ```
 */
export function classifyDifferential(
  { toml, }: { readonly toml: string; },
): DifferentialResult {
  /**
   * Our decoder's verdict.
   */
  const ours = decodeOurs({ toml, },);
  /**
   * Reference decoder's verdict.
   */
  const reference = decodeReference({ toml, },);
  return {
    kind: classifyVerdicts({
      ours,
      reference,
    },),
    toml,
    ours,
    reference,
  };
}

/**
 * Inputs whose differential divergence is a documented, impl-defined
 * disagreement rather than a defect.
 *
 * Empty: the type-level normalizer in `differential-compare.ts` resolves every
 * spec-equivalent spelling, so no input-specific exception has been needed. Any
 * future entry must cite, at its addition, why the divergence is impl-defined
 * (a TOML spec ambiguity), per the suppression discipline; this set holds the
 * raw source of each such input.
 */
const DIFFERENTIAL_ALLOWLIST: ReadonlySet<string> = new Set<string>();

/**
 * Whether a divergent input is an allow-listed, impl-defined disagreement.
 *
 * @param toml - TOML source that diverged.
 *
 * @returns Whether the divergence is excused.
 *
 * @example
 * ```ts
 * isAllowedDivergence({ toml: 'a = 1\n', }); // false
 * ```
 */
export function isAllowedDivergence({ toml, }: { readonly toml: string; },): boolean {
  return DIFFERENTIAL_ALLOWLIST.has(toml,);
}

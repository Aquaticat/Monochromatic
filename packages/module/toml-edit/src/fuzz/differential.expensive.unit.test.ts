/**
 * Phase 7 differential parser oracle.
 *
 * Runs every generated and corrupted document through both our decoder and the
 * pinned BurntSushi reference decoder, classifies the verdict pair, and fails on
 * the divergences that signal a real defect:
 *
 * - we accept, the reference rejects: our parser is too lax (the bare-`CR` class
 *   of bug). Hard fail.
 * - both accept but the tagged trees are not semantically equal: a genuine parse
 *   disagreement. Hard fail.
 *
 * A divergence where we reject and the reference accepts is logged, not failed:
 * BurntSushi has its own documented laxities, and matching them would loosen our
 * parser rather than fix it.
 *
 * This is a real unit test, just an expensive one: the `.expensive.` segment
 * excludes it from the default `test:unit` run (only `--all` or the dedicated
 * `test:differential` task includes it), so routine `test:unit` and CI runs never
 * spawn the external Go binary. The dedicated task is wired into CI explicitly so
 * the external execution stays visible. Per-property throughput is capped by one
 * subprocess per case (the `toml-test` protocol is strictly one document per
 * invocation), so it runs lighter than the in-process properties; the iteration
 * count is logged to make that explicit.
 *
 * @module
 */

import {
  assert,
  asyncProperty,
  constantFrom,
  oneof,
} from 'fast-check';

import {
  describe,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  tagged,
} from '@monochromatic-dev/module-logger';

import {
  DOCUMENT_EXAMPLES,
  documentArbitrary,
} from './arb-documents.ts';
import {
  classifyDifferential,
  type DifferentialResult,
  isAllowedDivergence,
} from './differential-oracle.ts';
import {
  fuzzRunPlan,
} from '../fuzz-budget.ts';
import {
  corruptedDocumentArbitrary,
} from './mutators.ts';

//region Setup

/**
 * Run plan resolved once for both properties.
 */
const RUN = fuzzRunPlan();

/**
 * Mutable per-property observation counters, held in a closure rather than
 * module state so each property reports its own totals.
 */
type DifferentialStats = {
  executed: number;
  readonly weStrict: Set<string>;
  readonly referenceEmptyKey: Set<string>;
};

/**
 * Render a divergence as a self-contained, JSON-escaped failure message so a
 * shrunk counterexample is directly actionable.
 *
 * @param result - Divergent differential result.
 *
 * @returns Multi-line diagnostic naming the direction and both verdicts.
 *
 * @example
 * ```ts
 * formatDivergence({ result, }); // 'differential divergence: ...'
 * ```
 */
function formatDivergence({ result, }: { readonly result: DifferentialResult; },): string {
  const direction = result.kind === 'diverge-we-lax'
    ? 'we accepted a document the reference rejected (parser too lax)'
    : 'both accepted but produced different tagged values';
  return [
    `differential divergence: ${direction}`,
    `input (JSON-escaped): ${JSON.stringify(result.toml,)}`,
    `ours: ${JSON.stringify(result.ours,)}`,
    `reference: ${JSON.stringify(result.reference,)}`,
  ]
    .join('\n',);
}

/**
 * Whether a classification is a hard-failure divergence (not logged-only and
 * not an agreement).
 *
 * @param kind - Differential classification.
 *
 * @returns Whether the kind must fail the property when not allow-listed.
 *
 * @example
 * ```ts
 * isHardFailureKind({ kind: 'diverge-we-lax', }); // true
 * ```
 */
function isHardFailureKind(
  { kind, }: { readonly kind: DifferentialResult['kind']; },
): boolean {
  return (kind === 'diverge-we-lax') || (kind === 'diverge-value');
}

/**
 * Check one document, recording stats and throwing on a hard divergence.
 *
 * @param toml - TOML source under test.
 *
 * @param stats - Closure-held counters for the enclosing property.
 *
 * @throws Error when the document is a non-allow-listed defect divergence.
 *
 * @example
 * ```ts
 * checkOne({ toml: 'a = 1\n', stats, }); // records one agreement
 * ```
 */
function checkOne(
  { toml, stats, }: { readonly toml: string; readonly stats: DifferentialStats; },
): void {
  stats.executed += 1;
  const result = classifyDifferential({ toml, },);
  if (result.kind === 'diverge-we-strict') {
    stats.weStrict
      .add(toml,);
    return;
  }
  if (result.kind === 'diverge-reference-empty-key') {
    stats.referenceEmptyKey
      .add(toml,);
    return;
  }
  if (isHardFailureKind({ kind: result.kind, },)
    && (!isAllowedDivergence({ toml, },)))
    throw new Error(formatDivergence({ result, },),);
}

/**
 * Log one property's coverage so a low subprocess-bound iteration count is never
 * mistaken for full in-process coverage.
 *
 * @param label - Property label.
 *
 * @param stats - Counters accumulated during the run.
 *
 * @example
 * ```ts
 * reportCoverage({ label: 'generated', stats, });
 * ```
 */
function reportCoverage(
  { label, stats, }: { readonly label: string; readonly stats: DifferentialStats; },
): void {
  tagged({ tag: reportCoverage.name, },)
    .info(
      `differential ${label}: ${String(stats.executed,)} cases run; we were stricter than the reference on ${String(stats.weStrict.size,)} distinct inputs; excused ${String(stats.referenceEmptyKey.size,)} distinct inputs for the reference empty-key bug`,
    );
}

//endregion Setup

await describe({
  name: 'differential parser oracle (BurntSushi reference)',
  children: [
    it({
      name: 'agrees with the reference decoder over generated documents',
      timeout: RUN.timeout,
      fn: async () => {
        /**
         * Counters for this property only.
         */
        const stats: DifferentialStats = {
          executed: 0,
          weStrict: new Set<string>(),
          referenceEmptyKey: new Set<string>(),
        };
        await assert(
          asyncProperty(
            oneof(documentArbitrary, constantFrom(...DOCUMENT_EXAMPLES,),),
            async function agrees(toml,) {
              checkOne({ toml, stats, },);
            },
          ),
          RUN.params,
        );
        reportCoverage({ label: 'generated', stats, },);
      },
    },),

    it({
      name: 'agrees on accept and reject over corrupted documents',
      timeout: RUN.timeout,
      fn: async () => {
        /**
         * Counters for this property only.
         */
        const stats: DifferentialStats = {
          executed: 0,
          weStrict: new Set<string>(),
          referenceEmptyKey: new Set<string>(),
        };
        await assert(
          asyncProperty(
            corruptedDocumentArbitrary,
            async function agrees(toml,) {
              checkOne({ toml, stats, },);
            },
          ),
          RUN.params,
        );
        reportCoverage({ label: 'corrupted', stats, },);
      },
    },),
  ],
},);

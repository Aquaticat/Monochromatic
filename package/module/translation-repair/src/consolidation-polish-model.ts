import type { AbsoluteNaturalnessReviewOutcome, } from './absolute-naturalness-review-stage.ts';
import type { ConsolidationPolishGateOutcome, } from './consolidation-polish-gate-stage.ts';
import type { RepairJudgedRound, } from './repair-round-record.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidation naturalness model

/**
 * Model roles and document facts needed by final body polish.
 *
 * @example
 * ```ts
 * const config: ConsolidationPolishConfig = { refinerModelIds, judgeModelIds, gateModelIds, declaredNames: [], definitions: '', };
 * ```
 */
export type ConsolidationPolishConfig = {
  /**
   * Rewriters proposing idiomatic paragraph replacements.
   */
  readonly refinerModelIds: readonly RosterModelId[];

  /**
   * Judges selecting rewrite slate winner.
   */
  readonly judgeModelIds: readonly RosterModelId[];

  /**
   * Fidelity-first roster deciding whether selected rewrite may ship.
   */
  readonly gateModelIds: readonly RosterModelId[];

  /**
   * Declared target name forms protected from deletion.
   */
  readonly declaredNames: readonly string[];

  /**
   * Link and footnote definitions used by rewrite guards.
   */
  readonly definitions: string;
};

/**
 * One rejected-input to gated-correction digest transition.
 *
 * @example
 * ```ts
 * const correction: ConsolidationNaturalnessCorrectionAudit = { inputDigest, findingsDigest, gatedTextDigest, };
 * ```
 */
export type ConsolidationNaturalnessCorrectionAudit = {
  /**
   * Exact rejected candidate supplied to correction.
   */
  readonly inputDigest: string;

  /**
   * Canonical structured findings supplied to correction.
   */
  readonly findingsDigest: string;

  /**
   * Exact post-fidelity-gate correction supplied to next review.
   */
  readonly gatedTextDigest: string;
};

/**
 * Absolute review rounds binding publication approval to exact final wording.
 *
 * @example
 * ```ts
 * const review: ConsolidationNaturalnessAudit = { correctionCount: 0, corrections: [], rounds: [] };
 * ```
 */
export type ConsolidationNaturalnessAudit = {
  /**
   * Dedicated corrective generations bought after initial rejection.
   */
  readonly correctionCount: 0 | 1 | 2;

  /**
   * Digest chain binding each accepted correction transition.
   */
  readonly corrections: readonly ConsolidationNaturalnessCorrectionAudit[];

  /**
   * Absolute whole-passage reviews in execution order.
   */
  readonly rounds: readonly AbsoluteNaturalnessReviewOutcome[];
};

/**
 * Auditable final polish decision for one consolidated slice.
 *
 * @example
 * ```ts
 * const polish: ConsolidationPolish = { kind: 'not-run', reason: 'front-matter', };
 * ```
 */
export type ConsolidationPolish =
  | {
    /**
     * No naturalness stage was applicable or configured.
     */
    readonly kind: 'not-run';

    /**
     * Why no body polish was bought.
     */
    readonly reason: 'front-matter' | 'not-configured' | 'unsafe-baseline';
  }
  | {
    /**
     * Naturalness stage examined approved base.
     */
    readonly kind: 'settled';

    /**
     * Already-approved text before naturalness work.
     */
    readonly baseText: string;

    /**
     * Selected rewrite proposal before final fidelity gate.
     */
    readonly proposedText: string;

    /**
     * Final text after conservative gate.
     */
    readonly text: string;

    /**
     * Whether final text differs from approved base.
     */
    readonly changed: boolean;

    /**
     * Rewriters heard with usable answer.
     */
    readonly refinersHeard: readonly RosterModelId[];

    /**
     * Models contributing selected proposal.
     */
    readonly contributors: readonly RosterModelId[];

    /**
     * Naturalness selection rounds retained for audit.
     */
    readonly rounds: readonly RepairJudgedRound[];

    /**
     * Final fidelity and naturalness gate, absent when no rewrite survived.
     */
    readonly gate?: ConsolidationPolishGateOutcome;

    /**
     * Absolute whole-passage approval bound to final text.
     */
    readonly review: ConsolidationNaturalnessAudit;

    /**
     * Findings from proposal, validation, gate and absolute review.
     */
    readonly findings: readonly string[];
  }
  | {
    /**
     * Naturalness work exhausted bounded correction without publishable text.
     */
    readonly kind: 'unsettled';

    /**
     * Approved fidelity baseline that remains unpublishable for naturalness.
     */
    readonly baseText: string;

    /**
     * Last selected correction proposal, whether or not gates accepted it.
     */
    readonly proposedText: string;

    /**
     * Rewriters returning usable answer across bounded rounds.
     */
    readonly refinersHeard: readonly RosterModelId[];

    /**
     * Models whose work last would-ship candidate carries.
     */
    readonly contributors: readonly RosterModelId[];

    /**
     * Candidate-selection rounds from initial and corrective generations.
     */
    readonly rounds: readonly RepairJudgedRound[];

    /**
     * Last comparative fidelity gate, when correction reached it.
     */
    readonly gate?: ConsolidationPolishGateOutcome;

    /**
     * Absolute reviews proving why publication remains refused.
     */
    readonly review: ConsolidationNaturalnessAudit;

    /**
     * Stable bounded-correction and review findings.
     */
    readonly findings: readonly string[];
  };

//endregion Consolidation naturalness model

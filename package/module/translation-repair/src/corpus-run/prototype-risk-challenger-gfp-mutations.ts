// PROTOTYPE ONLY: Candidate M mutation definitions for guard-failure proofs.

/**
 * One exact source mutation with deterministic replacement anchors.
 *
 * @example
 * ```ts
 * const mutation: CandidateMGfpMutation = CANDIDATE_M_GFP_MUTATIONS[0];
 * ```
 */
export type CandidateMGfpMutation = {
  /**
   * Stable evidence name.
   */
  readonly name: string;
  /**
   * Repository-relative source path inside disposable worktree.
   */
  readonly relativePath: string;
  /**
   * Exact committed source text removed by mutation.
   */
  readonly oldText: string;
  /**
   * Deliberately weakened replacement text.
   */
  readonly newText: string;
};

/**
 * Important Candidate M guards that targeted tests must detect when weakened.
 *
 * @example
 * ```ts
 * const mutationCount = CANDIDATE_M_GFP_MUTATIONS.length;
 * ```
 */
export const CANDIDATE_M_GFP_MUTATIONS: readonly CandidateMGfpMutation[] = [
  {
    name: 'verdict-finding-cardinality',
    relativePath: 'package/module/translation-repair/src/prototype-risk-challenger-guard.ts',
    oldText: `  if (((value.verdict !== 'clean') && (value.verdict !== 'defect'))
    || (!Array.isArray(value.findings,))
    || ((value.verdict === 'clean') && (value.findings
      .length
      > 0))
    || ((value.verdict === 'defect') && (value.findings
      .length
      !== 1)))
`,
    newText: `  if (((value.verdict !== 'clean') && (value.verdict !== 'defect'))
    || (!Array.isArray(value.findings,)))
`,
  },
  {
    name: 'candidate-binding-helper',
    relativePath: 'package/module/translation-repair/src/prototype-risk-challenger-plan.ts',
    oldText: `  if ((sourceReviewPlanDigest !== node.sourceReviewPlanDigest)
    || (schemaDigest !== node.schemaDigest))
    throw new Error('Candidate M source plan or schema digest differs');
`,
    newText: `  if ((sourceReviewPlanDigest !== node.sourceReviewPlanDigest)
    && (schemaDigest !== node.schemaDigest))
    throw new Error('Candidate M source plan or schema digest differs');
`,
  },
  {
    name: 'runtime-schema-rebuild',
    relativePath: 'package/module/translation-repair/src/prototype-risk-challenger-plan.ts',
    oldText: `          schemaDigest: hashContent({ content: JSON.stringify(format,), }),
`,
    newText: `          schemaDigest: hashContent({ content: 'mutated-schema', }),
`,
  },
  {
    name: 'architecture-restart-category',
    relativePath: 'package/module/translation-repair/src/prototype-risk-challenger-model.ts',
    oldText: `  'key-set',
  'raw-duplicate',
  'role',
`,
    newText: `  'key-set',
  'role',
`,
  },
  {
    name: 'author-admission-category',
    relativePath: 'package/module/translation-repair/src/prototype-risk-challenger-author-node.ts',
    oldText: `      failureCategory: 'candidate-binding',
`,
    newText: `      failureCategory: 'key-set',
`,
  },
  {
    name: 'strict-role-family-floor',
    relativePath: 'package/module/translation-repair/src/prototype-risk-challenger-selection.ts',
    oldText: `      === 2;
`,
    newText: `      === 1;
`,
  },
  {
    name: 'between-wave-abort-boundary',
    relativePath: 'package/module/translation-repair/src/prototype-risk-challenger-runtime.ts',
    oldText: `    value: authorSettlement,
    label: 'Candidate M author settlement',
  },);
  if (signal.aborted)
    throw signal.reason;
`,
    newText: `    value: authorSettlement,
    label: 'Candidate M author settlement',
  },);
`,
  },
];

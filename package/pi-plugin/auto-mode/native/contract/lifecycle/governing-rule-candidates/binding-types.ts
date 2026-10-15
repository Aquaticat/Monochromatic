/**
 Original governing-source projections retain structural evidence without authority. @module
 */
import type {
  IndexedPolicyRule,
  PolicyHeading,
  PolicyIndexInput,
  PolicySourceSpan,
} from '../../policy-index-types.ts';

/**
 The original source owner authenticates occurrence identity and any native content profile.
 */
export type GoverningSource = Readonly<{
  content: string;
  sha256: string;
  occurrence: unknown;
  kind?: unknown;
  contentFormat?: unknown;
}>;

/**
 Trusted bootstrap capabilities retain original source identity and parser behavior.
 */
export type GoverningBindingInput = Readonly<{
  readSource: () => GoverningSource;
  parse: PolicyIndexInput['parse'];
}>;

/**
 Native JSON content remains an unclassified span alongside ordinary Markdown nodes.
 */
export type RetainedPolicyNode = PolicySourceSpan & Readonly<{
  type: string;
  headings?: readonly PolicyHeading[];
}>;

/**
 Binding consumes only structural intervals, heading identities, and coverage state.
 */
export type GoverningBindingIndex = Readonly<{
  sourceSha256: string;
  records: readonly IndexedPolicyRule[];
  unclassified: readonly RetainedPolicyNode[];
  headings?: readonly PolicyHeading[];
  structuralCoverage: 'all-top-level-nodes-indexed' | 'unclassified-nodes-retained';
}>;

/**
 Every projection identifies original source bytes while withholding authority and meaning.
 */
type OriginalSourceProjection = Readonly<{
  sourceOccurrence: unknown;
  sourceSHA256: string;
  authorityEstablishedByIndex: false;
  semanticQualification: 'not-established';
}>;

/**
 Literal source tags and unclassified intervals remain distinct structural subjects.
 */
export type ClauseClassification = Readonly<{ code: string; kind?: never; nodeType?: never }>
  | Readonly<{ kind: 'unclassified-source-span'; nodeType: string; code?: never }>;

/**
 Original clause projection keeps exact source offsets and contextual heading text.
 */
export type GoverningClause = OriginalSourceProjection & PolicySourceSpan & ClauseClassification & Readonly<{
  textSHA256: string;
  headings: readonly string[];
}>;

/**
 Contextual headings form a separate source-wide content subject.
 */
export type GoverningHeadingContext = OriginalSourceProjection & Readonly<{
  kind: 'source-heading-context';
  code?: never;
  headings: readonly PolicyHeading[];
}>;

/**
 Original opaque handles select either one clause or one contextual-heading aggregate.
 */
export type GoverningRuleProjection = GoverningClause | GoverningHeadingContext;

/**
 Unclassified diagnostics retain the same original candidate as instruction enumeration.
 */
export type RetainedUnclassifiedClause = PolicySourceSpan & Readonly<{ candidate: Readonly<object>; type: string }>;

/**
 Candidate retention combines an original interval with its structural classification.
 */
export type GoverningClauseRetention = Readonly<{
  record: PolicySourceSpan & Readonly<{ headings?: readonly PolicyHeading[] }>;
  classification: ClauseClassification;
}>;

/**
 Private candidate capture retains optional aggregate identity before public inspection.
 */
export type GoverningCandidateCapture = Readonly<{
  records: WeakMap<object, GoverningRuleProjection>;
  byCode: ReadonlyMap<string, Readonly<object>>;
  candidateHandles: readonly Readonly<object>[];
  instructionHandles: readonly Readonly<object>[];
  headingCandidates: readonly Readonly<object>[];
  retainedUnclassified: readonly RetainedUnclassifiedClause[];
  retainedContextualHeadings: readonly PolicyHeading[];
  headingContextCandidate?: Readonly<object>;
}>;

/**
 Retained diagnostics preserve original failure values and the absent aggregate key.
 */
export type GoverningBindingSnapshot = Readonly<{
  retainedOnly: true;
  stale: boolean;
  failure: unknown;
  sourceSHA256: string;
  codes: readonly string[];
  unclassified: readonly RetainedUnclassifiedClause[];
  instructionCandidates: readonly Readonly<object>[];
  contextualHeadings: readonly PolicyHeading[];
  headingContextCandidate: GoverningCandidateCapture['headingContextCandidate'];
  structuralCoverage: GoverningBindingIndex['structuralCoverage'];
  authorityEstablishedByIndex: false;
  semanticQualification: 'not-established';
}>;

/**
 Current reads authenticate original membership while inspection retains historical diagnostics.
 */
export type GoverningRuleBindings = Readonly<{
  select: (code: unknown) => Readonly<object>;
  read: (handle: unknown) => GoverningRuleProjection;
  indexedCandidates: () => readonly Readonly<object>[];
  indexedInstructionCandidates: () => readonly Readonly<object>[];
  indexedHeadingContextCandidates: () => readonly Readonly<object>[];
  inspect: () => GoverningBindingSnapshot;
}>;

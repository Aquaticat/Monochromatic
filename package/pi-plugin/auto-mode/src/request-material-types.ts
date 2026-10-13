/**
 Original request content references remain distinct from authority and completeness.

 @module
 */

//region The native judgment authenticates these borrowed records before consumption

/**
 Supported content relationships, not directive effects or verdicts.
 */
export type RequestMaterialRelation = 'none' | 'potential-instruction' | 'unknown';

/**
 Original choice value already validated by the question owner's decoder.
 */
export type RequestMaterialEstimateValue = {
  /**
   Consumer validates the selected relationship independently of model attribution.
   */
  readonly choice: string;
  /**
   Original probabilities reach the fixed code acceptance callback unchanged.
   */
  readonly probabilities: Readonly<Record<string, number>>;
};

/**
 Original evidence projection, whose batch identity is authenticated by the native judgment.
 */
export type RequestMaterialEvidence = {
  /**
   Fixed question definition selected by the native compiler.
   */
  readonly definitionId: string;
  /**
   Native definition distinguishes a choice from another answer grammar.
   */
  readonly definition: { readonly type: string; };
  /**
   Original request reference cannot be substituted by equal serialized bytes.
   */
  readonly binding: {
    readonly claimScope: string;
    readonly requestMaterial: object
  };
  /**
   Missing or mismatching attribution prevents semantic admission.
   */
  readonly model?: string;
  /**
   Unsupported statuses are rejected; an explicit unresolved answer need not have a value.
   */
  readonly answer: {
    readonly status: string;
    readonly value?: RequestMaterialEstimateValue
  };
};

/**
 Fixed code policy only admits or abstains from using an original estimate.
 */
export type RequestMaterialAdmission = {
  /**
   Serving-model identity selected before judgment execution.
   */
  readonly model: string;
  /**
   Return value is checked at runtime so promises and verdict-shaped objects cannot become admission.
   */
  readonly accepts: (value: RequestMaterialEstimateValue,) => unknown;
};

/**
 Original identity readers remain owned by native integration, not authenticated by TypeScript shape.
 */
export type RequestMaterialJudgment = {
  /**
   Obtain the original occurrence with its incumbent dependency checks and receiver.
   */
  readonly requestMaterialFor: () => object;
};

/**
 Bound source views reference their original request observation.
 */
export type RequestMaterialInputs = {
  /**
   Empty source views leave a separate missing-source obligation with the compiler.
   */
  readonly instructionSources: readonly { readonly request: { readonly request: object; }; }[];
};

/**
 Derived content interpretation retains its original evidence without assigning governing authority.
 */
export type RequestMaterialInterpretation<Evidence extends RequestMaterialEvidence = RequestMaterialEvidence> = {
  /**
   Original request occurrence returned by the native judgment.
   */
  readonly request: object;
  /**
   Original authenticated batch member, not a reconstructed answer.
   */
  readonly evidence: Evidence;
  /**
   Content interpretation grants no execution permission.
   */
  readonly permission: false;
} & (
  | {
    /**
     Fixed code policy admitted this relationship estimate.
     */
    readonly admission: 'admitted';
    /**
     Estimated content use remains independent of source-domain coverage.
     */
    readonly relation: RequestMaterialRelation;
  }
  | {
    /**
     No relationship is used when policy, attribution or the answer abstains.
     */
    readonly admission: 'abstained';
    /**
     Abstention deliberately carries no selected relationship.
     */
    readonly relation?: never;
  }
);

/**
 Existing premise diagnostics may carry opaque source, request and evidence references.
 */
export type RequestMaterialPremiseIssue = {
  /**
   Compiler-owned premise category.
   */
  readonly premise: string;
  /**
   Optional diagnostic discriminator preserved without interpreting unrelated kinds.
   */
  readonly kind?: string;
  /**
   Original diagnostic details remain opaque to content-use accounting.
   */
  readonly [key: string]: unknown;
};

//endregion Borrowed identity and owned interpretation

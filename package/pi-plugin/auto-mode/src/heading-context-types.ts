/**
 Original source-local heading interpretations carry no directive or authority.

 @module
 */

/**
 Heading content presence is distinct from the meaning of any surrounding clause.
 */
export type HeadingContentRelation = 'none' | 'potential-instruction' | 'unknown';

/**
 Original decoded choice reaches code policy without replacing its value identity.
 */
export type HeadingContentEstimate = {
  /**
   Consumer validates the selected content relation before code admission.
   */
  readonly choice: string;
  /**
   Original normalized probabilities are retained by the native question owner.
   */
  readonly probabilities: Readonly<Record<string, number>>;
};

/**
 Native caller authenticates complete-batch membership before this projection is consumed.
 */
export type HeadingContextEvidence = {
  /**
   Fixed definition for aggregate heading-group content.
   */
  readonly definitionId: string;
  /**
   Choice grammar is required for this consumer.
   */
  readonly definition: { readonly type: string; };
  /**
   Original source-group projection, not a claim of instruction authority.
   */
  readonly binding: {
    readonly claimScope: string;
    readonly headingContext: { readonly kind: string; };
  };
  /**
   Missing attribution cannot admit an estimate.
   */
  readonly model?: string;
  /**
   Explicit unresolved answers need not carry a value.
   */
  readonly answer: {
    readonly status: string;
    readonly value?: HeadingContentEstimate
  };
};

/**
 Code policy admits content use only, never a directive classification or verdict.
 */
export type HeadingContextAdmission = {
  /**
   Serving model fixed at bootstrap.
   */
  readonly model: string;
  /**
   Runtime return validation rejects asynchronous and verdict-shaped results.
   */
  readonly accepts: (value: HeadingContentEstimate,) => unknown;
};

/**
 Derived interpretation holds exact borrowed candidate and evidence references.
 */
export type HeadingContextInterpretation<Candidate extends object, Evidence extends HeadingContextEvidence> = {
  /**
   Original source-group handle selected by the native owner.
   */
  readonly candidate: Candidate;
  /**
   Original record from the authenticated full batch.
   */
  readonly evidence: Evidence;
  /**
   Content presence grants no execution permission.
   */
  readonly permission: false;
} & (
  | {
    /**
     Configured code policy admitted this relationship estimate.
     */
    readonly admission: 'admitted';
    /**
     Independent heading-content relation, not another directive.
     */
    readonly relation: HeadingContentRelation;
  }
  | {
    /**
     Missing attribution, unresolved content or code abstention retains uncertainty.
     */
    readonly admission: 'abstained';
    /**
     No selected relationship accompanies abstention.
     */
    readonly relation?: never;
  }
);

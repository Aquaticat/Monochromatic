/**
 Original same-source unit pair identities are not established by structural selection alone.

 @module
 */

/**
 Original pair, member or quoted-unit binding did not match the supported consumer.
 */
export class UnitAdoptionBindingError extends Error {
  /**
   Stable diagnostic identity preserves original causes through Error's constructor.
   */
  override readonly name = 'UnitAdoptionBindingError';
}

/**
 Minimal original rule projection read by the incumbent judgment owner.
 */
export type UnitRuleProjection<SourceOccurrence = object> = {
  /**
   Original source identity, never equal bytes or a path.
   */
  readonly sourceOccurrence: SourceOccurrence;
  /**
   Tagged adopter code identifies only a structural opportunity.
   */
  readonly code?: string;
  /**
   Original parser unit family.
   */
  readonly kind?: string;
  /**
   Only a whole blockquote is supported as an incorporation target.
   */
  readonly nodeType?: string;
};

/**
 Original member and clause handles remain borrowed identity capabilities.
 */
export type UnitAdoptionPair<PreparedMember = object> = {
  /**
   Tagged adopter clause handle.
   */
  readonly adopter: object;
  /**
   Quoted target unit handle.
   */
  readonly target: object;
  /**
   Single original member to which the selected relationship applies.
   */
  readonly member: PreparedMember;
};

/**
 Original decoded choice remains owned by the authenticated question batch.
 */
export type UnitAdoptionEstimate = {
  /**
   Only adopts can establish this bounded incorporation scope; other choices grant none.
   */
  readonly choice: string;
  /**
   Additional decoded data is retained without reconstruction.
   */
  readonly [key: string]: unknown;
};

/**
 Native caller authenticates complete-batch membership before this record is consumed.
 */
export type UnitAdoptionEvidence = {
  /**
   Fixed unit-adoption question definition.
   */
  readonly definitionId: string;
  /**
   Only choice-form estimates are supported.
   */
  readonly definition: { readonly type: string; };
  /**
   Original member and source projections selected by the native owner.
   */
  readonly binding: {
    readonly claimScope: string;
    readonly member: object;
    readonly memberOrdinal: number;
    readonly adopter: UnitRuleProjection;
    readonly target: UnitRuleProjection;
  };
  /**
   Missing or different attribution cannot admit the estimate.
   */
  readonly model?: string;
  /**
   Explicit unresolved answers do not require a value.
   */
  readonly answer: {
    readonly status: string;
    readonly value?: UnitAdoptionEstimate
  };
};

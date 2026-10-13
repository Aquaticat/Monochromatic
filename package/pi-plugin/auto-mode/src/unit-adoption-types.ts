/**
 Borrowed scope proofs and owned incorporation results remain distinct from directive meaning.

 @module
 */
import type { AuthorizationRequirement, } from './authorization-requirement.ts';
import type { LoweredClause, } from './clause-lowering.ts';
import type { InstructionRule, } from './instruction-rule.ts';
import type { UnitAdoptionEvidence, UnitRuleProjection, } from './unit-adoption-binding.ts';

/**
 Original registered authority still requires membership and request-scope checks.
 */
export type UnitRegisteredAuthority = {
  /**
   Native registration family, not authority inferred from source placement.
   */
  readonly kind: 'registered-instruction-authority';
  /**
   Original governing source occurrence.
   */
  readonly sourceOccurrence: object;
  /**
   Code-established priority remains subject to the maintained lowering validator.
   */
  readonly priority: number;
  /**
   Original request observation to which registration applies.
   */
  readonly scope: { readonly kind: string; readonly request: object; };
};

/**
 Unresolved authority remains an explicit normal domain state.
 */
export type UnitAuthority = UnitRegisteredAuthority | { readonly kind: 'unresolved-instruction-authority'; };

/**
 Original source view is authenticated by native integration, not this TypeScript shape.
 */
export type UnitSourceView = {
  /**
   Absent occurrence leaves source scope unresolved.
   */
  readonly sourceOccurrence?: object;
  /**
   Original request observation, never a reconstructed equivalent.
   */
  readonly request?: object;
};

/**
 Independent clause interpretation exists before incorporation can use its target meaning.
 */
export type UnitClauseInterpretation = {
  /**
   Original clause handle used as the update key.
   */
  readonly rule: object;
  /**
   Target effects are usable only after independent admission.
   */
  readonly admission: string;
  /**
   Original clause answer, not the adoption-only answer.
   */
  readonly evidence: { readonly answer: { readonly value?: { readonly choice: string; }; }; };
  /**
   A quoted target cannot already carry lowered directives or requirements.
   */
  readonly lowered?: LoweredClause;
  /**
   Other original clause fields are retained by owned updates.
   */
  readonly [key: string]: unknown;
};

/**
 Original source and prepared member owners remain outside this consumer.
 */
export type UnitAdoptionInputs = {
  /**
   Exactly one original effect member is supported by this incorporation profile.
   */
  readonly effects: readonly {
    readonly member: object;
    readonly owner?: object;
    readonly programInspection?: object;
  }[];
  /**
   Original registered authority references.
   */
  readonly instructionAuthorities: readonly UnitAuthority[];
  /**
   Original captured source-view references.
   */
  readonly instructionSources: readonly UnitSourceView[];
  /**
   Read the original projection through its incumbent identity owner.
   */
  readonly readRule: (handle: object,) => UnitRuleProjection;
  /**
   Read the original source view for the selected adopter.
   */
  readonly sourceViewFor: (handle: object,) => UnitSourceView;
  /**
   Read independently established authority or its explicit unresolved state.
   */
  readonly authorityFor: (handle: object,) => UnitAuthority;
};

/**
 Original-reference incorporation interpretation supplies no independent directive.
 */
export type UnitAdoptionInterpretation = {
  /**
   Original adopter handle.
   */
  readonly adopter: object;
  /**
   Original target handle.
   */
  readonly target: object;
  /**
   Original sole prepared member.
   */
  readonly member: object;
  /**
   Original authenticated pair estimate.
   */
  readonly evidence: UnitAdoptionEvidence;
  /**
   Code admission remains distinct from scope establishment.
   */
  readonly admission: 'admitted' | 'abstained';
  /**
   Unadmitted estimates carry no selected relationship.
   */
  readonly relation?: string;
  /**
   Incorporation itself grants no permission.
   */
  readonly permission: false;
  /**
   Whether this bounded original-source use has independent authority and scope.
   */
  readonly scopeEstablished: boolean;
  /**
   Present only when original authority and request membership establish scope.
   */
  readonly authority?: UnitRegisteredAuthority;
};

/**
 Independent unresolved meaning or scope diagnostic.
 */
export type UnitAdoptionIssue = {
  /**
   Premise category consumed by the native compiler.
   */
  readonly premise: 'qualified-rule-interpretation' | 'instruction-authority-and-scope';
  /**
   Meaning uncertainty is distinct from missing adopter scope.
   */
  readonly kind: 'unit-adoption-meaning' | 'unit-adoption-adopter-scope';
  /**
   Original adopter whose governing use remains unresolved.
   */
  readonly rule: object;
  /**
   Original pair evidence retained for diagnostics.
   */
  readonly evidence: UnitAdoptionEvidence;
  /**
   Code-owned explanation, not a model verdict.
   */
  readonly reason: string;
};

/**
 Fresh result collections do not authenticate fabricated input owners or close a host domain.
 */
export type UnitAdoptionResult = {
  /**
   Original-reference interpretation records in issuance order.
   */
  readonly interpretations: readonly UnitAdoptionInterpretation[];
  /**
   Directives come only from independently interpreted, properly scoped targets.
   */
  readonly rules: readonly InstructionRule[];
  /**
   Target prerequisites remain constraints, not permission.
   */
  readonly authorizationRequirements: readonly AuthorizationRequirement[];
  /**
   Independent unknowns remain visible to the compiler.
   */
  readonly issues: readonly UnitAdoptionIssue[];
  /**
   Owned clause updates preserve all unrelated original fields.
   */
  readonly updates: ReadonlyMap<object, UnitClauseInterpretation>;
  /**
   Adopters represented by supported incorporation control meaning.
   */
  readonly adopters: ReadonlySet<object>;
  /**
   Targets with established incorporation scope, independently of target meaning.
   */
  readonly targets: ReadonlySet<object>;
};

/**
 Mapping of admitted clause relationships into internal directive and prerequisite facts.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  type AuthorizationRequirement,
  readAuthorizationRequirement,
} from './authorization-requirement.ts';
import { type InstructionRule, readInstructionPriority, } from './instruction-rule.ts';
import {
  InstructionResolutionInputError,
  readPolicyIdentity,
  readPolicyRecord,
} from './policy-data.ts';

//region Meaning vocabulary does not authenticate model replies or governing sources

/**
 Supported meaning labels do not represent final policy verdicts.
 */
export type ClauseRelation = 'permission' | 'prohibition' | 'prerequisite' | 'none' | 'unsupported' | 'unknown';

/**
 Supported clause meanings remain separate from final policy verdicts.
 */
export const CLAUSE_RELATIONS: readonly ClauseRelation[] = Object.freeze([
  'permission',
  'prohibition',
  'prerequisite',
  'none',
  'unsupported',
  'unknown',
] as const,);

/**
 Scope or interpretation gaps not discharged by this pure mapping.
 */
type ClausePremise = 'instruction-authority-and-scope' | 'qualified-rule-interpretation';

/**
 Derived facts require original source, estimate and operation admission before native use.
 */
export type LoweredClause = {
  /**
   Permissions and prohibitions do not include bare authorization prerequisites.
   */
  readonly rules: readonly InstructionRule[];
  /**
   Conditions restrict separately established permission.
   */
  readonly authorizationRequirements: readonly AuthorizationRequirement[];
  /**
   Unknown semantics are broader than uncertainty among supported directive effects.
   */
  readonly missingPremises: readonly ClausePremise[];
};

/**
 Lowering diagnostics exclude original instruction text.
 */
const l = tagged({ tag: 'auto-mode-clause-lowering', },);

/**
 Narrow only catalog membership, not semantic truth or admission.

 @param value - label selected by calling code

 @returns whether the label belongs to the implemented meaning vocabulary
 */
function isClauseRelation(value: unknown,): value is ClauseRelation {
  return CLAUSE_RELATIONS.some(function matches(candidate,) {
    return candidate === value;
  },);
}

/**
 Seal freshly owned lowering arrays without freezing submitted facts.

 @param value - arrays created inside clause lowering

 @returns immutable derived fact collections
 */
function sealLowering(value: LoweredClause,): LoweredClause {
  return Object.freeze({
    rules: Object.freeze(value.rules,),
    authorizationRequirements: Object.freeze(value.authorizationRequirements,),
    missingPremises: Object.freeze(value.missingPremises,),
  },);
}

/**
 Lower a whole-operation relationship already admitted by trusted code policy.
 This function authenticates neither its input nor source authority, operation coverage or semantic accuracy.
 Native consumers must bind each estimate, scope and any waiver through original owners.
 A prerequisite supplies no permission and is never converted to conditional authorization.
 Satisfaction and approval-channel sufficiency remain independent facts.

 @param input - admitted internal relationship, not raw model reply or caller completeness flags

 @returns directives, prerequisites and independent missing premises

 @throws {@link InstructionResolutionInputError} for unsupported shapes or relationship facts

 @example
 ```ts
 lowerEstablishedClause({ id: 'policy', priority: 0, relation: 'prohibition' });
 ```
 */
export function lowerEstablishedClause(input: unknown,): LoweredClause {
  /**
   Preserve the function boundary without logging submitted clause content.
   */
  const rl = tagged({ tag: lowerEstablishedClause.name, l, },);
  rl.debug('lowering an admitted internal clause relationship',);
  /**
   Extra fields cannot turn model metadata into admitted facts.
   */
  const value = readPolicyRecord({
    input,
    fields: ['id', 'priority', 'relation', 'authorization',],
  },);
  /**
   Identity remains bounded without establishing its source.
   */
  const id = readPolicyIdentity(value.id,);
  /**
   Relation labels require a supported meaning, not a final verdict.
   */
  const { relation, } = value;
  if (!isClauseRelation(relation,))
    throw new InstructionResolutionInputError('Established clause relationship is outside the supported meaning catalog',);
  /**
   Only absent priority leaves authority unresolved; invalid supplied priorities fail.
   */
  const priority = value.priority === undefined ? undefined : readInstructionPriority(value.priority,);
  if (Object.hasOwn(value, 'authorization',) && relation !== 'prerequisite')
    throw new InstructionResolutionInputError('Authorization facts belong only to an established prerequisite',);
  /**
   Each invocation owns its output arrays independently of submitted records.
   */
  const rules: InstructionRule[] = [];
  /**
   Prerequisites never join the directive precedence calculation.
   */
  const authorizationRequirements: AuthorizationRequirement[] = [];
  /**
   Independent unknowns stay explicit instead of being narrowed to an effect guess.
   */
  const missingPremises: ClausePremise[] = [];
  if (relation === 'none') {
    rl.debug('no operative relationship contributes a directive or prerequisite',);
    return sealLowering({ rules, authorizationRequirements, missingPremises, },);
  }
  if (priority === undefined) {
    rl.debug('clause has no established authority priority',);
    missingPremises.push('instruction-authority-and-scope',);
  }
  switch (relation) {
    case 'unknown':
    case 'unsupported': {
      rl.debug('clause meaning retains interpretation uncertainty',);
      missingPremises.push('qualified-rule-interpretation',);
      return sealLowering({ rules, authorizationRequirements, missingPremises, },);
    }
    case 'permission':
    case 'prohibition': {
      if (priority !== undefined) {
        rl.debug('retaining a directive with code-established priority',);
        rules.push(Object.freeze({
          id,
          priority,
          effect: relation === 'permission' ? 'permit' : 'prohibit',
          applicability: 'applies',
        },),);
      }
      return sealLowering({ rules, authorizationRequirements, missingPremises, },);
    }
    case 'prerequisite': {
      /**
       Missing facts remain unresolved; explicit invalid values are not treated as absence.
       */
      const facts: Readonly<Record<string, unknown>> = Object.hasOwn(value, 'authorization',)
        ? readPolicyRecord({ input: value.authorization, fields: ['satisfaction', 'channel',], },)
        : {};
      /**
       Validate prerequisite facts even when source authority remains unavailable.
       */
      const requirement = readAuthorizationRequirement({
        id,
        applicability: 'applies',
        satisfaction: Object.hasOwn(facts, 'satisfaction',) ? facts.satisfaction : 'unresolved',
        channel: Object.hasOwn(facts, 'channel',) ? facts.channel : 'unresolved',
      },);
      if (priority !== undefined) {
        rl.debug('retaining an independent authorization prerequisite',);
        authorizationRequirements.push(requirement,);
      }
      return sealLowering({ rules, authorizationRequirements, missingPremises, },);
    }
  }
}

//endregion Admitted relationships

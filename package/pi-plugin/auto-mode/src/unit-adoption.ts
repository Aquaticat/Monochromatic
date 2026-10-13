/**
 Apply bounded same-source incorporation without manufacturing an independent directive.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { AuthorizationRequirement, } from './authorization-requirement.ts';
import { lowerEstablishedClause, } from './clause-lowering.ts';
import type { InstructionRule, } from './instruction-rule.ts';
import type { SemanticAcceptance, } from './semantic-admission-types.ts';
import { UnitAdoptionBindingError, type UnitAdoptionEvidence, type UnitAdoptionPair, } from './unit-adoption-binding.ts';
import { admitUnitAdoption, admittedUnitClauseChoice, assertUnitAdoptionBinding, unitAdoptionValue, } from './unit-adoption-meaning.ts';
import type {
  UnitAdoptionInputs,
  UnitAdoptionInterpretation,
  UnitAdoptionIssue,
  UnitAdoptionResult,
  UnitClauseInterpretation,
} from './unit-adoption-types.ts';

/**
 Incorporation logs never serialize original source or estimate records.
 */
const l = tagged({ tag: 'auto-mode-unit-adoption', },);

/**
 Apply the accepted same-source incorporation rule to authenticated original pair estimates.
 Native callers authenticate batch identity and revalidate original dependencies after callbacks.
 Adoption supplies control meaning and target scope, not its own permission or prohibition.
 Target meaning and registered source/request scope remain independently necessary.
 Owned records and arrays are frozen; borrowed owners, clauses and capabilities are not.

 @param records - original pair records from the authenticated complete batch

 @param pairs - original selected structural opportunities

 @param inputs - original member, source and authority owners

 @param policy - fixed code acceptance policy, absent only for an empty selection

 @param clauses - independently interpreted original clauses

 @returns owned interpretations, target facts, unresolved issues and reference-keyed clause updates

 @throws UnitAdoptionBindingError for mismatched original selection, scope or prior target lowering

 @throws original reader, policy or lowering error without replacing its value

 @example
 ```ts
 const incorporation = consumeUnitAdoptions({ records, pairs, inputs, policy, clauses });
 // Only independently interpreted targets can contribute directives or prerequisites.
 ```
 */
export function consumeUnitAdoptions(
  { records, pairs, inputs, policy, clauses, }: {
    readonly records: readonly UnitAdoptionEvidence[];
    readonly pairs: readonly UnitAdoptionPair[];
    readonly inputs: UnitAdoptionInputs;
    readonly policy?: { readonly model: string; readonly accepts: SemanticAcceptance; };
    readonly clauses: readonly UnitClauseInterpretation[];
  },
): UnitAdoptionResult {
  /**
   This consumer does not establish native owner authenticity or whole-domain completeness.
   */
  const rl = tagged({ tag: consumeUnitAdoptions.name, l, },);
  rl.debug('consuming original same-source incorporation estimates',);
  if (records.length !== pairs.length)
    throw new UnitAdoptionBindingError('Unit-adoption estimates differ from the complete original pair selection',);
  if (records.length > 0 && policy === undefined)
    throw new UnitAdoptionBindingError('Selected unit-adoption estimates require their configured code policy',);
  /**
   Original clause handles correlate meaning without using codes or equal text as identity.
   */
  const indexed = new Map(clauses.map(function indexClause(clause, index,) {
    return [clause.rule, { clause, index, },] as const;
  },),);
  /**
   These collections belong only to the current consumption result.
   */
  const interpretations: UnitAdoptionInterpretation[] = [];
  /**
   Directives arise only from independently interpreted targets.
   */
  const rules: InstructionRule[] = [];
  /**
   Prerequisites remain independent constraints on permission.
   */
  const authorizationRequirements: AuthorizationRequirement[] = [];
  /**
   Unsupported meaning and unresolved authority are retained separately.
   */
  const issues: UnitAdoptionIssue[] = [];
  /**
   New clause records retain original untouched fields.
   */
  const updates = new Map<object, UnitClauseInterpretation>();
  /**
   Represented adopter control meanings remain distinct from target scope.
   */
  const adopters = new Set<object>();
  /**
   Scoped target handles do not imply admitted target meanings.
   */
  const targets = new Set<object>();
  for (const [index, record,] of records.entries()) {
    /**
     Missing pairs cannot create an interpretation with invented handles.
     */
    const pair = pairs[index];
    if (pair === undefined || policy === undefined)
      throw new UnitAdoptionBindingError('Unit adoption requires its original selected pair and code policy',);
    /**
     Original readers retain their native receivers and currentness checks.
     */
    const adopter = inputs.readRule(pair.adopter,);
    /**
     Target projection must be the same one selected by the original batch.
     */
    const target = inputs.readRule(pair.target,);
    assertUnitAdoptionBinding({ record, pair, adopter, target, inputs, },);
    /**
     Code admission does not establish source or request scope.
     */
    const admitted = admitUnitAdoption({ record, policy, },);
    /**
     No selected relationship is carried when code abstains.
     */
    const relation = admitted ? unitAdoptionValue(record,).choice : undefined;
    /**
     Owned interpretation base contains only original references and content-use state.
     */
    const base = {
      adopter: pair.adopter, target: pair.target, member: pair.member, evidence: record,
      admission: admitted ? 'admitted' as const : 'abstained' as const,
      ...(relation === undefined ? {} : { relation, }), permission: false as const,
    };
    if (relation !== 'adopts') {
      interpretations.push(Object.freeze({ ...base, scopeEstablished: false, },),);
      if (relation !== 'none') {
        issues.push(Object.freeze({
          premise: 'qualified-rule-interpretation', kind: 'unit-adoption-meaning', rule: pair.adopter, evidence: record,
          reason: 'The selected incorporation remains unknown, unsupported or unadmitted; no target scope is established.',
        },),);
      }
      continue;
    }
    /**
     Both clauses need their original independent interpretations.
     */
    const adopterEntry = indexed.get(pair.adopter,);
    /**
     Target ordinal supplies the same deterministic lowering ID as the original compiler.
     */
    const targetEntry = indexed.get(pair.target,);
    if (adopterEntry === undefined || targetEntry === undefined)
      throw new UnitAdoptionBindingError('Unit incorporation requires independent original clause interpretations',);
    /**
     Original adopter meaning may disagree with an adoption-only interpretation.
     */
    const adopterClause = adopterEntry.clause;
    /**
     Original target meaning is never inferred from the adopter.
     */
    const targetClause = targetEntry.clause;
    /**
     Primitive meaning and adoption-only control meaning cannot both represent the complete adopter.
     */
    const primitive = adopterClause.admission === 'admitted'
      && ['permission', 'prohibition', 'prerequisite',].includes(admittedUnitClauseChoice(adopterClause,),);
    /**
     Original source view remains independent of textual equality.
     */
    const source = inputs.sourceViewFor(pair.adopter,);
    /**
     Original authority must belong to the supplied native binding set.
     */
    const authority = inputs.authorityFor(pair.adopter,);
    /**
     Source registration alone cannot establish another request's incorporation scope.
     */
    const scoped = !primitive && inputs.instructionAuthorities.includes(authority,)
      && inputs.instructionSources.includes(source,) && authority.kind === 'registered-instruction-authority'
      && authority.sourceOccurrence === adopter.sourceOccurrence && source.sourceOccurrence === adopter.sourceOccurrence
      && authority.scope.kind === 'original-request' && authority.scope.request === source.request;
    /**
     Scope is derived from original owner references, never a caller completeness flag.
     */
    const interpretation = Object.freeze({ ...base, scopeEstablished: scoped, ...(scoped ? { authority, } : {}), },);
    interpretations.push(interpretation,);
    if (!scoped) {
      issues.push(Object.freeze({
        premise: primitive ? 'qualified-rule-interpretation' : 'instruction-authority-and-scope',
        kind: 'unit-adoption-adopter-scope', rule: pair.adopter, evidence: record,
        reason: primitive
          ? 'The primitive-clause and adoption-only interpretations disagree about the complete adopter; no incorporation is admitted.'
          : 'The adopter lacks independently established original source authority and request scope.',
      },),);
      continue;
    }
    adopters.add(pair.adopter,);
    targets.add(pair.target,);
    /**
     The binding check established the original sole effect member.
     */
    const [effect,] = inputs.effects;
    if (effect === undefined)
      throw new UnitAdoptionBindingError('Unit adoption lost its original prepared member',);
    /**
     Independent implementation-fact contracts keep their existing coverage obligations.
     */
    const operationApplication = effect.owner === undefined
      ? Object.freeze({ kind: 'admitted-unit-adoption-estimate', member: pair.member, programInspection: effect.programInspection, },)
      : undefined;
    updates.set(pair.adopter, Object.freeze({
      ...adopterClause, representedByAdoption: interpretation, ...(operationApplication ? { operationApplication, } : {}),
    },),);
    if (targetClause.admission !== 'admitted')
      continue;
    /**
     Only supported independently admitted target relations can be lowered.
     */
    const targetRelation = admittedUnitClauseChoice(targetClause,);
    if (!['permission', 'prohibition', 'prerequisite', 'none',].includes(targetRelation,))
      continue;
    if (targetClause.lowered?.rules.length || targetClause.lowered?.authorizationRequirements.length)
      throw new UnitAdoptionBindingError('Quoted target was already lowered without its incorporation scope',);
    /**
     Maintained lowering validates priority and keeps prerequisites separate from permission.
     */
    const lowered = lowerEstablishedClause({ id: `clause-${targetEntry.index}`, priority: authority.priority, relation: targetRelation, },);
    rules.push(...lowered.rules,);
    authorizationRequirements.push(...lowered.authorizationRequirements,);
    updates.set(pair.target, Object.freeze({ ...targetClause, lowered, incorporationScope: interpretation, },),);
  }
  return Object.freeze({
    interpretations: Object.freeze(interpretations,), rules: Object.freeze(rules,),
    authorizationRequirements: Object.freeze(authorizationRequirements,), issues: Object.freeze(issues,), updates, adopters, targets,
  },);
}

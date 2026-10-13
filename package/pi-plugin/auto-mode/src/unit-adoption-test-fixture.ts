/**
 Disposable source, member and clause references for maintained incorporation controls.

 @module
 */
import {
  lowerEstablishedClause,
  type consumeUnitAdoptions,
  type UnitAdoptionEvidence,
  type UnitAdoptionPair,
  type UnitClauseInterpretation,
  type UnitRegisteredAuthority,
  type UnitRuleProjection,
  type UnitSourceView,
} from '@monochromatic-dev/pi-plugin-auto-mode';

/**
 Each fixture owns fresh references without claiming native provenance.
 */
export type UnitAdoptionFixture = {
  /**
   Original structural opportunity for this fixture.
   */
  readonly pair: UnitAdoptionPair;
  /**
   Tagged adopter projection.
   */
  readonly adopter: UnitRuleProjection;
  /**
   Whole quoted target projection.
   */
  readonly target: UnitRuleProjection;
  /**
   Original source view used for request-scope checks.
   */
  readonly source: UnitSourceView;
  /**
   Original registered authority with its own request reference.
   */
  readonly authority: UnitRegisteredAuthority;
  /**
   Original pair record remains distinct from clause records.
   */
  readonly record: UnitAdoptionEvidence;
  /**
   Original independently interpreted clauses.
   */
  readonly clauses: readonly UnitClauseInterpretation[];
  /**
   Test-local count of actual policy invocations.
   */
  readonly calls: { admissions: number; };
  /**
   Reuse the actual maintained API input contract.
   */
  readonly options: Parameters<typeof consumeUnitAdoptions>[0];
};

/**
 Construct original-reference doubles with independently lowered unscoped target meaning.

 @param relation - original incorporation answer

 @param targetRelation - independently interpreted quoted target

 @param adopterRelation - independent complete-adopter meaning

 @returns isolated fixture with no SDK or provider access

 @example
 ```ts
 const fixture = createUnitAdoptionFixture({ targetRelation: 'prerequisite' });
 const result = consumeUnitAdoptions(fixture.options);
 ```
 */
export function createUnitAdoptionFixture(
  { relation = 'adopts', targetRelation = 'prohibition', adopterRelation = 'unsupported', }: {
    readonly relation?: string;
    readonly targetRelation?: string;
    readonly adopterRelation?: string;
  } = {},
): UnitAdoptionFixture {
  /**
   Equal empty objects remain independent identity tokens.
   */
  const pair = { adopter: {}, target: {}, member: {}, };
  /**
   Shared occurrence joins only this fixture's two original units.
   */
  const sourceOccurrence = {};
  /**
   Original request observation cannot be substituted by a copied object.
   */
  const request = {};
  /**
   Tagged structure alone supplies no incorporation meaning.
   */
  const adopter: UnitRuleProjection = { sourceOccurrence, code: 'ADP', };
  /**
   Target remains the original whole blockquote.
   */
  const target: UnitRuleProjection = { sourceOccurrence, kind: 'unclassified-source-span', nodeType: 'blockquote', };
  /**
   Original source view is separately checked against the binding list.
   */
  const source: UnitSourceView = { sourceOccurrence, request, };
  /**
   Priority is a fixture fact, not obtained from the semantic answer.
   */
  const authority: UnitRegisteredAuthority = {
    kind: 'registered-instruction-authority', sourceOccurrence, priority: 1,
    scope: { kind: 'original-request', request, },
  };
  /**
   Pair and clause evidence are different records with different selected relationships.
   */
  const record: UnitAdoptionEvidence = {
    definitionId: 'unit_adoption', definition: { type: 'choice', }, model: 'fixture-model',
    binding: { claimScope: 'member-unit-adoption', member: pair.member, memberOrdinal: 0, adopter, target, },
    answer: { status: 'estimate', value: { choice: relation, probabilities: { [relation]: 1, }, }, },
  };
  /**
   Original target lowering intentionally lacks incorporation priority.
   */
  const clauses: readonly UnitClauseInterpretation[] = [
    { rule: pair.adopter, admission: 'admitted', evidence: { answer: { value: { choice: adopterRelation, }, }, }, lowered: lowerEstablishedClause({ id: 'clause-0', priority: 1, relation: adopterRelation, },), },
    { rule: pair.target, admission: 'admitted', evidence: { answer: { value: { choice: targetRelation, }, }, }, lowered: lowerEstablishedClause({ id: 'clause-1', relation: targetRelation, },), },
  ];
  /**
   Invocations remain separate from declared policy presence.
   */
  const calls = { admissions: 0, };
  /**
   Methods keep fixed original identity readers rather than a string registry.
   */
  const options: Parameters<typeof consumeUnitAdoptions>[0] = {
    records: [record,], pairs: [pair,], clauses,
    policy: { model: 'fixture-model', accepts() { calls.admissions++; return true; }, },
    inputs: {
      instructionAuthorities: [authority,], instructionSources: [source,],
      effects: [{ member: pair.member, programInspection: {}, },],
      readRule(handle) {
        if (handle === pair.adopter)
          return adopter;
        if (handle === pair.target)
          return target;
        throw new Error('Foreign fixture rule handle',);
      },
      sourceViewFor() { return source; },
      authorityFor() { return authority; },
    },
  };
  return { pair, adopter, target, source, authority, record, clauses, calls, options, };
}

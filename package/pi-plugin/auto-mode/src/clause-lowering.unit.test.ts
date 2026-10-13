/**
 Built-artifact mapping controls use authored facts, not qualified model responses.

 @module
 */
import {
  CLAUSE_RELATIONS,
  type GuardOutcome,
  InstructionResolutionInputError,
  lowerEstablishedClause,
  resolveGuardOutcome,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

/**
 Compose only authored fixture premises; this creates no native evidence capability.

 @param clauses - fixture relationships with explicitly chosen facts

 @returns internal outcome of fixture composition
 */
function outcome(clauses: readonly unknown[],): GuardOutcome {
  /**
   Keep each authored clause's missing premises when composing fixture facts.
   */
  const lowered = clauses.map(lowerEstablishedClause,);
  return resolveGuardOutcome({
    premises: lowered.some(function missing(value,) {
      return value.missingPremises.length > 0;
    },) ? 'incomplete' : 'complete',
    rules: lowered.flatMap(function rules(value,) {
      return value.rules;
    },),
    authorizationRequirements: lowered.flatMap(function requirements(value,) {
      return value.authorizationRequirements;
    },),
  },);
}

await describe({
  name: lowerEstablishedClause.name,
  children: [
    //region Directives and prerequisites have separate meanings

    ...[
      { relation: 'permission', verdict: 'approve', },
      { relation: 'prohibition', verdict: 'deny', },
    ].map(function directive({ relation, verdict, },) {
      return it({
        name: `lowers ${relation} without inferring other premises`,
        fn: async function checkDirective() {
          expect(outcome([{ id: 'directive', priority: 0, relation, },],),).toMatchObject({ state: 'resolved', verdict, },);
        },
      },);
    },),
    it({
      name: 'none contributes neither a directive nor an authority requirement',
      fn: async function checkNone() {
        expect(lowerEstablishedClause({ id: 'none', relation: 'none', },),).toEqual({
          rules: [], authorizationRequirements: [], missingPremises: [],
        },);
        expect(outcome([{ id: 'none', relation: 'none', },],).state,).toBe('unspecified',);
        expect(Object.isFrozen(CLAUSE_RELATIONS,),).toBe(true,);
      },
    },),
    ...['permission', 'prohibition', 'prerequisite',].map(function missingPriority(relation,) {
      return it({
        name: `retains missing authority for ${relation}`,
        fn: async function checkPriority() {
          expect(lowerEstablishedClause({ id: 'missing', relation, },),).toEqual({
            rules: [], authorizationRequirements: [], missingPremises: ['instruction-authority-and-scope',],
          },);
        },
      },);
    },),
    ...['unknown', 'unsupported',].map(function uncertainMeaning(relation,) {
      return it({
        name: `keeps ${relation} broader than supported-effect uncertainty`,
        fn: async function checkMeaning() {
          const knownAuthority = lowerEstablishedClause({ id: 'uncertain', priority: 0, relation, },);
          expect(knownAuthority,).toEqual({
            rules: [], authorizationRequirements: [], missingPremises: ['qualified-rule-interpretation',],
          },);
          expect(lowerEstablishedClause({ id: 'uncertain', relation, },).missingPremises,).toEqual([
            'instruction-authority-and-scope', 'qualified-rule-interpretation',
          ],);
        },
      },);
    },),
    it({
      name: 'prerequisites grant no permission and cannot override prohibitions',
      fn: async function checkPrerequisites() {
        const permit = { id: 'permit', priority: 2, relation: 'permission', };
        const prohibit = { id: 'prohibit', priority: 2, relation: 'prohibition', };
        const prerequisite = { id: 'condition', priority: 0, relation: 'prerequisite', };
        const unmet = { ...prerequisite, authorization: { satisfaction: 'unsatisfied', channel: 'incumbent-approval', }, };
        const satisfied = { ...prerequisite, authorization: { satisfaction: 'satisfied', }, };
        expect(outcome([prerequisite,],).state,).toBe('unresolved',);
        expect(outcome([permit, prerequisite,],).state,).toBe('unresolved',);
        expect(outcome([prohibit, prerequisite,],),).toMatchObject({ verdict: 'deny', },);
        expect(outcome([permit, unmet,],),).toMatchObject({ verdict: 'ask', },);
        expect(outcome([permit, satisfied,],),).toMatchObject({ verdict: 'approve', },);
        expect(outcome([satisfied,],).state,).toBe('unspecified',);
        expect(outcome([prohibit, unmet,],),).toMatchObject({ verdict: 'deny', },);
        expect(outcome([permit, prohibit,],).state,).toBe('unresolved',);
        expect(outcome([permit, { ...prerequisite, authorization: { satisfaction: 'unsatisfied', channel: 'unsupported', }, },],).state,).toBe('unresolved',);
        expect(lowerEstablishedClause(unmet,).rules,).toEqual([],);
        expect(lowerEstablishedClause({ ...prerequisite, authorization: {}, },).authorizationRequirements,).toEqual([
          { id: 'condition', applicability: 'applies', satisfaction: 'unresolved', channel: 'unresolved', },
        ],);
      },
    },),

    //endregion Meaning boundaries

    //region Closed records do not accept raw replies or admission flags

    ...[
      null, [], Object.create(null,), {}, { id: 'missing-relation', },
      { relation: 'none', }, { id: '', relation: 'none', }, { id: 'x'.repeat(257,), relation: 'none', },
      ...[-1, 256, 0.5, '0', Number.NaN, Number.POSITIVE_INFINITY,].map(function badPriority(priority,) {
        return { id: 'bad-priority', priority, relation: 'none', };
      },),
      { id: 'bad-relation', relation: 'permit', },
      { id: 'raw', relation: 'permission', qualified: true, },
      { choice: 'permission', probabilities: { permission: 1, }, },
      { id: 'extra', relation: 'none', authorization: {}, },
      ...[null, undefined, { satisfaction: undefined, }, { satisfaction: null, }, { channel: undefined, }, { channel: false, }, { waived: true, },].map(function badAuthorization(authorization,) {
        return { id: 'bad-authorization', priority: 0, relation: 'prerequisite', authorization, };
      },),
    ].map(function malformed(input, index,) {
      return it({
        name: `rejects unsupported relationship input ${index}`,
        fn: async function checkMalformed() {
          expect(function lowerInvalid() {
            lowerEstablishedClause(input,);
          },).toThrow(InstructionResolutionInputError,);
        },
      },);
    },),
    it({
      name: 'rejects getters and proxies before observation with working positive controls',
      fn: async function checkObservation() {
        const reads: string[] = [];
        const accessor = {
          id: 'getter',
          get relation() {
            reads.push('relation',);
            return 'permission';
          },
        };
        const proxy = new Proxy({ satisfaction: 'satisfied', }, {
          getPrototypeOf(): object {
            reads.push('proxy',);
            return Object.prototype;
          },
        },);
        expect(function getter() {
          lowerEstablishedClause(accessor,);
        },).toThrow(InstructionResolutionInputError,);
        expect(function nestedProxy() {
          lowerEstablishedClause({ id: 'proxy', priority: 0, relation: 'prerequisite', authorization: proxy, },);
        },).toThrow(InstructionResolutionInputError,);
        expect(function outerProxy() {
          lowerEstablishedClause(proxy,);
        },).toThrow(InstructionResolutionInputError,);
        expect(reads,).toEqual([],);
        Reflect.get(accessor, 'relation',);
        Reflect.getPrototypeOf(proxy,);
        expect(reads,).toEqual(['relation', 'proxy',],);
      },
    },),
    it({
      name: 'retains exact bounds and freezes only owned derived facts',
      fn: async function checkOwnership() {
        const input = { id: '😀'.repeat(64,), priority: 255, relation: 'permission', };
        const result = lowerEstablishedClause(input,);
        expect(result.rules[0],).toMatchObject({ id: input.id, priority: 255, effect: 'permit', },);
        expect(Object.isFrozen(input,),).toBe(false,);
        for (const value of [result, result.rules, result.authorizationRequirements, result.missingPremises, result.rules[0],])
          expect(Object.isFrozen(value,),).toBe(true,);
        const authorization = { satisfaction: 'satisfied', };
        const requirement = lowerEstablishedClause({ id: 'condition', priority: 0, relation: 'prerequisite', authorization, },);
        expect(Object.isFrozen(requirement.authorizationRequirements[0],),).toBe(true,);
        expect(Object.isFrozen(authorization,),).toBe(false,);
      },
    },),

    //endregion Structural boundaries
  ],
},);

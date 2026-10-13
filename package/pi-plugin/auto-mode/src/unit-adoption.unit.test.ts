/**
 Built-artifact incorporation scope and independent target-meaning controls.

 @module
 */
import {
  CLAUSE_RELATIONS,
  consumeUnitAdoptions,
  flushPolicyDiagnostics,
  lowerEstablishedClause,
  UnitAdoptionBindingError,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createUnitAdoptionFixture, } from './unit-adoption-test-fixture.ts';

await describe({
  name: consumeUnitAdoptions.name,
  children: [
    ...['adopts', 'none', 'unknown', 'unsupported',].flatMap(function relationCases(relation,) {
      return CLAUSE_RELATIONS.map(function targetCase(targetRelation,) {
        return it({
          name: `${relation} with independent ${targetRelation} target meaning`,
          fn: async function checkMeaning() {
            const f = createUnitAdoptionFixture({ relation, targetRelation, },);
            const result = consumeUnitAdoptions(f.options,);
            const [interpretation,] = result.interpretations;
            if (interpretation === undefined)
              throw new Error('Original unit interpretation is missing',);
            expect(interpretation.adopter,).toBe(f.pair.adopter,);
            expect(interpretation.target,).toBe(f.pair.target,);
            expect(interpretation.member,).toBe(f.pair.member,);
            expect(interpretation.evidence,).toBe(f.record,);
            expect(interpretation.permission,).toBe(false,);
            expect(interpretation.scopeEstablished,).toBe(relation === 'adopts',);
            expect(result.rules.length,).toBe((relation === 'adopts') && ['permission', 'prohibition',].includes(targetRelation,) ? 1 : 0,);
            expect(result.authorizationRequirements.length,).toBe((relation === 'adopts') && (targetRelation === 'prerequisite') ? 1 : 0,);
            expect(result.issues.length,).toBe((relation === 'unknown') || (relation === 'unsupported') ? 1 : 0,);
            expect(f.calls.admissions,).toBe(1,);
            expect(Object.isFrozen(interpretation,),).toBe(true,);
            expect(Object.isFrozen(result.rules,),).toBe(true,);
            for (const borrowed of [f.pair, f.record, f.source, f.authority, f.options.inputs, f.clauses,])
              expect(Object.isFrozen(borrowed,),).toBe(false,);
            if (result.rules.length > 0) {
              expect(result.rules[0],).toHaveProperty('priority', 1,);
              expect(result.rules[0],).toHaveProperty('id', 'clause-1',);
            }
            const update = result.updates.get(f.pair.target,);
            if (update !== undefined)
              expect(update.evidence,).toBe(f.clauses[1]?.evidence,);
          },
        },);
      },);
    },),
    it({
      name: 'keeps independent implementation-fact coverage separate from incorporation',
      fn: async function checkOwnedFact() {
        const f = createUnitAdoptionFixture();
        const result = consumeUnitAdoptions({
          ...f.options,
          inputs: { ...f.options.inputs, effects: [{ member: f.pair.member, owner: {}, programInspection: {}, },], },
        },);
        const update = result.updates.get(f.pair.adopter,);
        if (update === undefined)
          throw new Error('Original adopter update is missing',);
        expect(Object.hasOwn(update, 'operationApplication',),).toBe(false,);
        expect(result.interpretations[0],).toHaveProperty('scopeEstablished', true,);
      },
    },),
    it({
      name: 'scoped but unadmitted target meaning contributes no directive or requirement',
      fn: async function checkUnadmittedTarget() {
        const f = createUnitAdoptionFixture();
        const clauses = f.clauses.map(function abstainTarget(clause,) {
          return clause.rule === f.pair.target ? { ...clause, admission: 'abstained', evidence: { answer: {}, }, } : clause;
        },);
        const result = consumeUnitAdoptions({ ...f.options, clauses, },);
        expect(result.targets.has(f.pair.target,),).toBe(true,);
        expect(result.updates.has(f.pair.adopter,),).toBe(true,);
        expect(result.updates.has(f.pair.target,),).toBe(false,);
        expect(result.rules,).toEqual([],);
        expect(result.authorizationRequirements,).toEqual([],);
      },
    },),
    ...['permission', 'prerequisite',].map(function existingLowering(relation,) {
      return it({
        name: `rejects a quoted target already lowered as ${relation}`,
        fn: async function checkPriorLowering() {
          const f = createUnitAdoptionFixture();
          const clauses = f.clauses.map(function lowerTarget(clause,) {
            return clause.rule === f.pair.target
              ? { ...clause, lowered: lowerEstablishedClause({ id: 'premature', priority: 1, relation, },), }
              : clause;
          },);
          expect(function invoke() {
            consumeUnitAdoptions({ ...f.options, clauses, },);
          },).toThrow(UnitAdoptionBindingError,);
        },
      },);
    },),
    it({
      name: 'a target without a prior lowering record still requires independent scoped meaning',
      fn: async function checkAbsentLowering() {
        const f = createUnitAdoptionFixture();
        const clauses = f.clauses.map(function originalWithoutLowering(clause,) {
          const copy = { ...clause, };
          Reflect.deleteProperty(copy, 'lowered',);
          return copy;
        },);
        const result = consumeUnitAdoptions({ ...f.options, clauses, },);
        expect(result.rules.length,).toBe(1,);
        expect(result.rules[0],).toHaveProperty('priority', 1,);
      },
    },),
    ...['adopter', 'target',].map(function absentMeaning(role,) {
      return it({
        name: `an admitted ${role} must retain its independent original meaning`,
        fn: async function checkMissingMeaning() {
          const f = createUnitAdoptionFixture();
          const handle = role === 'adopter' ? f.pair.adopter : f.pair.target;
          const clauses = f.clauses.map(function withoutMeaning(clause,) {
            return clause.rule === handle ? { ...clause, evidence: { answer: {}, }, } : clause;
          },);
          expect(function invoke() {
            consumeUnitAdoptions({ ...f.options, clauses, },);
          },).toThrow('independent admitted clause meaning',);
        },
      },);
    },),
    it({
      name: 'empty unconfigured selection contributes nothing and freezes only owned output',
      fn: async function checkEmpty() {
        const f = createUnitAdoptionFixture();
        const result = consumeUnitAdoptions({ records: [], pairs: [], clauses: [], inputs: f.options.inputs, },);
        expect(result.interpretations,).toEqual([],);
        expect(result.rules,).toEqual([],);
        expect(result.authorizationRequirements,).toEqual([],);
        expect(result.issues,).toEqual([],);
        expect(result.updates.size,).toBe(0,);
        expect(result.adopters.size,).toBe(0,);
        expect(result.targets.size,).toBe(0,);
        expect(Object.isFrozen(result,),).toBe(true,);
      },
    },),
  ],
},);
await flushPolicyDiagnostics();

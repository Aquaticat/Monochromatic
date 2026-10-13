/**
 Built-artifact structural pair selection does not establish incorporation meaning.

 @module
 */
import {
  flushPolicyDiagnostics,
  selectUnitAdoptionPairs,
  UnitAdoptionBindingError,
  type UnitRuleProjection,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createUnitAdoptionFixture, } from './unit-adoption-test-fixture.ts';

await describe({
  name: selectUnitAdoptionPairs.name,
  children: [
    it({
      name: 'retains original pair identities without reading meanings or merging equal occurrences',
      fn: async function checkOriginals() {
        const a = createUnitAdoptionFixture();
        const b = createUnitAdoptionFixture();
        const candidates = [a.pair.adopter, a.pair.target, b.pair.adopter, b.pair.target,];
        const member = {};
        function readRule(handle: object,): UnitRuleProjection {
          return (handle === a.pair.adopter) || (handle === a.pair.target) ? a.options.inputs.readRule(handle,) : b.options.inputs.readRule(handle,);
        }
        const result = selectUnitAdoptionPairs({ candidates, readRule, member, },);
        expect(result.length,).toBe(2,);
        expect(result[0],).toEqual({ adopter: a.pair.adopter, target: a.pair.target, member, },);
        expect(result[1],).toEqual({ adopter: b.pair.adopter, target: b.pair.target, member, },);
        expect(Object.isFrozen(result,),).toBe(true,);
        expect(Object.isFrozen(result[0],),).toBe(true,);
        expect(Object.isFrozen(candidates,),).toBe(false,);
        expect(a.calls.admissions + b.calls.admissions,).toBe(0,);
      },
    },),
    ...['single', 'duplicate', 'no-adopter', 'unclassified-adopter', 'no-quote', 'target-kind', 'split-source',].map(function missingPair(mode,) {
      return it({
        name: `does not select a ${mode} structural profile`,
        fn: async function checkMissing() {
          const f = createUnitAdoptionFixture();
          const candidates = mode === 'single' ? [f.pair.adopter,]
            : mode === 'duplicate' ? [f.pair.adopter, f.pair.adopter, f.pair.target,]
              : [f.pair.adopter, f.pair.target,];
          function readRule(handle: object,): UnitRuleProjection {
            const value = f.options.inputs.readRule(handle,);
            if ((mode === 'no-adopter') && (handle === f.pair.adopter))
              return { sourceOccurrence: value.sourceOccurrence, };
            if ((mode === 'unclassified-adopter') && (handle === f.pair.adopter))
              return { ...value, kind: 'unclassified-source-span', };
            if ((mode === 'target-kind') && (handle === f.pair.target))
              return { ...value, kind: 'other', };
            if ((mode === 'no-quote') && (handle === f.pair.target))
              return { ...value, nodeType: 'paragraph', };
            if ((mode === 'split-source') && (handle === f.pair.target))
              return { ...value, sourceOccurrence: {}, };
            return value;
          }
          expect(selectUnitAdoptionPairs({ candidates, readRule, member: f.pair.member, },),).toEqual([],);
        },
      },);
    },),
    it({
      name: 'preserves the original 64-source structural opportunity bound',
      fn: async function checkBound() {
        const candidates: object[] = [];
        const projections = new Map<object, UnitRuleProjection>();
        for (let index = 0; index < 65; index++) {
          const sourceOccurrence = {};
          const adopter = {};
          const target = {};
          candidates.push(adopter, target,);
          projections.set(adopter, { sourceOccurrence, code: 'ADP', },);
          projections.set(target, { sourceOccurrence, kind: 'unclassified-source-span', nodeType: 'blockquote', },);
        }
        function readRule(handle: object,): UnitRuleProjection {
          const projection = projections.get(handle,);
          if (projection === undefined)
            throw new Error('Unknown original fixture rule',);
          return projection;
        }
        expect(selectUnitAdoptionPairs({ candidates: candidates.slice(0, 128,), readRule, member: {}, },).length,).toBe(64,);
        expect(function invoke() {
          selectUnitAdoptionPairs({ candidates, readRule, member: {}, },);
        },).toThrow(UnitAdoptionBindingError,);
      },
    },),
  ],
},);
await flushPolicyDiagnostics();

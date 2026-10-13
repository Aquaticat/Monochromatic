/**
 Built-artifact incorporation requires original registered authority and request scope.

 @module
 */
import {
  consumeUnitAdoptions,
  flushPolicyDiagnostics,
  type UnitAuthority,
  type UnitRegisteredAuthority,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createUnitAdoptionFixture, } from './unit-adoption-test-fixture.ts';

await describe({
  name: 'original incorporation authority and scope',
  children: [
    ...['unregistered', 'authority-not-listed', 'source-not-listed', 'authority-occurrence', 'source-occurrence', 'request-copy', 'scope-kind',].map(function scopeCase(mode,) {
      return it({
        name: `withholds target scope for ${mode}`,
        fn: async function checkScope() {
          const f = createUnitAdoptionFixture();
          const authority: UnitAuthority = mode === 'unregistered' ? { kind: 'unresolved-instruction-authority', }
            : { ...f.authority,
              ...(mode === 'authority-occurrence' ? { sourceOccurrence: {}, } : {}),
              scope: { ...f.authority.scope, ...(mode === 'request-copy' ? { request: {}, } : {}), ...(mode === 'scope-kind' ? { kind: 'foreign', } : {}), },
            };
          const source = mode === 'source-occurrence' ? { ...f.source, sourceOccurrence: {}, } : f.source;
          const result = consumeUnitAdoptions({
            ...f.options,
            inputs: {
              ...f.options.inputs,
              instructionAuthorities: mode === 'authority-not-listed' ? [] : [authority,],
              instructionSources: mode === 'source-not-listed' ? [] : [source,],
              authorityFor() { return authority; },
              sourceViewFor() { return source; },
            },
          },);
          expect(result.interpretations[0],).toHaveProperty('scopeEstablished', false,);
          expect(result.issues[0],).toHaveProperty('kind', 'unit-adoption-adopter-scope',);
          expect(result.issues[0],).toHaveProperty('premise', 'instruction-authority-and-scope',);
          expect(result.rules,).toEqual([],);
          expect(result.authorizationRequirements,).toEqual([],);
          expect(result.adopters.size,).toBe(0,);
          expect(result.targets.size,).toBe(0,);
        },
      },);
    },),
    ...['permission', 'prohibition', 'prerequisite',].map(function primitiveCase(adopterRelation,) {
      return it({
        name: `${adopterRelation} conflicts with adoption-only control meaning`,
        fn: async function checkPrimitiveConflict() {
          const f = createUnitAdoptionFixture({ adopterRelation, },);
          const result = consumeUnitAdoptions(f.options,);
          expect(result.interpretations[0],).toHaveProperty('scopeEstablished', false,);
          expect(result.issues[0],).toHaveProperty('premise', 'qualified-rule-interpretation',);
          expect(result.issues[0],).toHaveProperty('kind', 'unit-adoption-adopter-scope',);
          expect(result.rules,).toEqual([],);
          expect(result.updates.size,).toBe(0,);
        },
      },);
    },),
    ...[0, 1, 2,].map(function priorityCase(priority,) {
      return it({
        name: `uses only original registered priority ${priority} for target lowering`,
        fn: async function checkPriority() {
          const f = createUnitAdoptionFixture();
          const authority: UnitRegisteredAuthority = { ...f.authority, priority, };
          const result = consumeUnitAdoptions({
            ...f.options,
            inputs: { ...f.options.inputs, instructionAuthorities: [authority,], authorityFor: () => authority, },
          },);
          expect(result.rules[0],).toHaveProperty('priority', priority,);
          expect(result.interpretations[0],).toHaveProperty('authority', authority,);
        },
      },);
    },),
    it({
      name: 'adoption control can represent an abstained adopter without altering its original record',
      fn: async function checkIndependentControlMeaning() {
        const f = createUnitAdoptionFixture();
        const clauses = f.clauses.map(function abstainAdopter(clause,) {
          return clause.rule === f.pair.adopter ? { ...clause, admission: 'abstained', evidence: { answer: {}, }, } : clause;
        },);
        const result = consumeUnitAdoptions({ ...f.options, clauses, },);
        expect(result.interpretations[0],).toHaveProperty('scopeEstablished', true,);
        expect(result.rules.length,).toBe(1,);
        expect(clauses[0],).toHaveProperty('admission', 'abstained',);
        expect(result.updates.get(f.pair.adopter,),).toHaveProperty('representedByAdoption', result.interpretations[0],);
      },
    },),
  ],
},);
await flushPolicyDiagnostics();

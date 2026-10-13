/**
 Built-artifact incorporation preserves original reader failures and rejects lost fixture state.

 @module
 */
import {
  consumeUnitAdoptions,
  flushPolicyDiagnostics,
  UnitAdoptionBindingError,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { throwNativeValue, thrownValues, } from './native-query-test-fixture.ts';
import { createUnitAdoptionFixture, } from './unit-adoption-test-fixture.ts';

await describe({
  name: 'unit incorporation original readers',
  children: [
    ...(['readRule', 'sourceViewFor', 'authorityFor',] as const).flatMap(function readerCases(reader,) {
      return [false, undefined,].map(function failureCase(original, index,) {
        return it({
          name: `${reader} retains original failure ${index}`,
          fn: async function checkReaderFailure() {
            const f = createUnitAdoptionFixture();
            const failures = thrownValues(function invoke() {
              consumeUnitAdoptions({
                ...f.options,
                inputs: {
                  ...f.options.inputs,
                  [reader](): never {
                    throwNativeValue(original,);
                    throw new Error('Native exception must not return',);
                  },
                },
              },);
            },);
            expect(failures.length,).toBe(1,);
            expect(failures[0],).toBe(original,);
          },
        },);
      },);
    },),
    it({
      name: 'a disappearing member cannot be replaced by an invented operation application',
      fn: async function checkLostMember() {
        const f = createUnitAdoptionFixture();
        const state = { reads: 0, };
        const inputs = {
          ...f.options.inputs,
          get effects() {
            state.reads++;
            return state.reads <= 2 ? f.options.inputs.effects : [];
          },
        };
        expect(function invoke() {
          consumeUnitAdoptions({ ...f.options, inputs, },);
        },).toThrow('lost its original prepared member',);
        expect(state.reads,).toBe(3,);
      },
    },),
    it({
      name: 'changed admitted-clause state cannot be read as established meaning',
      fn: async function checkChangedMeaning() {
        const f = createUnitAdoptionFixture();
        const state = { reads: 0, };
        const clauses = f.clauses.map(function changingAdopter(clause,) {
          if (clause.rule !== f.pair.adopter)
            return clause;
          return {
            ...clause,
            get admission(): string {
              state.reads++;
              return state.reads === 1 ? 'admitted' : 'abstained';
            },
          };
        },);
        expect(function invoke() {
          consumeUnitAdoptions({ ...f.options, clauses, },);
        },).toThrow(UnitAdoptionBindingError,);
        expect(state.reads,).toBe(2,);
      },
    },),
  ],
},);
await flushPolicyDiagnostics();

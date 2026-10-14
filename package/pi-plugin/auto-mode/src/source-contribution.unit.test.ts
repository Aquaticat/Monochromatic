/**
 Built original-contribution consumer retains identity, partial scope and borrowed mutability.

 @module
 */
import { consumeSourceAssociations, flushPolicyDiagnostics, PolicyInputBindingError, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { contributionProfiles, createContributionFixture, } from './source-contribution-test-fixture.ts';
import { thrownValues, throwNativeValue, } from './native-query-test-fixture.ts';

await describe({
  name: consumeSourceAssociations.name,
  children: [
    ...contributionProfiles.map(function profileCase(profile,) {
      return it({
        name: `accounts for original ${profile} without authority or completeness`,
        fn: async function checkOriginal() {
          const f = createContributionFixture(profile,), result = consumeSourceAssociations(f.inputs,);
          expect(result.issues.length,).toBe(0,);
          expect(result.uses.length,).toBe(1,);
          expect(result.uses[0]?.state,).toBe('accounted',);
          expect(result.uses[0]?.contribution,).toBe(f.contribution.contribution,);
          expect(result.uses[0]?.request,).toBe(f.observation.request,);
          expect(result.uses[0]?.location,).toBe(f.contribution.location,);
          expect(result.uses[0]?.sourceOccurrence,).toBe(f.source.occurrence,);
          expect(result.uses[0]?.permission,).toBe(false,);
          expect(result.uses[0]?.coverage,).toBe('partial-original-prompt-input-contribution',);
          expect(Object.hasOwn(result.uses[0] ?? {}, 'priority',),).toBe(false,);
          expect(Object.isFrozen(result,),).toBe(true,);
          expect(Object.isFrozen(result.uses,),).toBe(true,);
          expect(Object.isFrozen(result.uses[0],),).toBe(true,);
          expect(Object.isFrozen(result.issues,),).toBe(true,);
          for (const borrowed of [f.inputs, f.source, f.publication, f.run, f.view, f.observation, f.contribution, f.association,]) {
            expect(Object.isFrozen(borrowed,),).toBe(false,);
          }
        },
      },);
    },),
    it({
      name: 'empty or absent contribution selection supplies no completeness assertion',
      fn: async function checkEmpty() {
        const f = createContributionFixture('base',);
        delete f.inputs.requestObservation;
        delete f.inputs.requestSourceContributions;
        for (const input of [f.inputs, { ...f.inputs, requestSourceContributions: [] }]) {
          const result = consumeSourceAssociations(input);
          expect(result,).toEqual({ uses: [], issues: [], },);
          expect(Object.hasOwn(result, 'complete',),).toBe(false,);
        }
      },
    },),
    it({
      name: 'foreign request, list and request-bound source view reject',
      fn: async function checkRequestIdentity() {
        const f = createContributionFixture('base',);
        /** Omitted request identity exercises the ordinary optional-field contract. */
        const missing = { ...f.inputs };
        delete missing.requestObservation;
        for (const input of [
          missing,
          { ...f.inputs, requestObservation: { ...f.observation, request: {}, }, },
          { ...f.inputs, requestSourceContributions: [...f.observation.sourceContributions,], },
          { ...f.inputs, instructionSources: [{ ...f.view, request: { ...f.observation, }, },], },
        ]) {
          expect(function invoke() { consumeSourceAssociations(input,); },).toThrow(PolicyInputBindingError,);
        }
      },
    },),
    it({
      name: 'equal-looking independent sources retain their distinct original contributions',
      fn: async function checkIndependentSources() {
        const first = createContributionFixture('base',), second = createContributionFixture('base',);
        second.contribution.request = first.observation.request;
        first.observation.sourceContributions = [first.contribution, second.contribution,];
        second.view.request = first.observation;
        const result = consumeSourceAssociations({
          ...first.inputs, requestSourceContributions: first.observation.sourceContributions,
          instructionSources: [first.view, second.view,],
          instructionCarriers: [first.carrier, second.carrier,],
          runInstructionCarriers: [first.runCarrier, second.runCarrier,],
        },);
        expect(result.uses.map(function state(use,) { return use.state; },),).toEqual(['accounted', 'accounted',],);
        expect(result.uses[0]?.sourceOccurrence,).not.toBe(result.uses[1]?.sourceOccurrence,);
        expect(result.uses[0]?.contribution,).not.toBe(result.uses[1]?.contribution,);
      },
    },),
    ...[false, undefined,].map(function readerFailure(original, index,) {
      return it({
        name: `preserves exact original request reader failure ${index}`,
        fn: async function checkReader() {
          const f = createContributionFixture('base',);
          const inputs = { ...f.inputs, get requestObservation(): never { throwNativeValue(original,); throw new Error('Native throw must not return',); }, };
          const failures = thrownValues(function invoke() { consumeSourceAssociations(inputs,); },);
          expect(failures.length,).toBe(1,);
          expect(failures[0],).toBe(original,);
        },
      },);
    },),
  ],
},);
await flushPolicyDiagnostics();

/**
 Built original-contribution consumer refuses copied or absent origin edges.

 @module
 */
import { consumeSourceAssociations, flushPolicyDiagnostics, type SourceContributionInputs, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { contributionProfiles, createContributionFixture, } from './source-contribution-test-fixture.ts';

/**
 Check unresolved origin diagnostics without permitting a directive or hiding the contribution.

 @param fixture - disposable original graph with one removed or mismatched edge

 @example
 ```ts
 const fixture = createContributionFixture('base');
 fixture.association.source = { ...fixture.source };
 expectUnresolved(fixture);
 ```
 */
function expectUnresolved(fixture: {
  readonly inputs: SourceContributionInputs;
  readonly contribution: { readonly contribution: object; };
},): void {
  const result = consumeSourceAssociations(fixture.inputs,);
  expect(result.uses[0]?.state,).toBe('unresolved',);
  expect(result.uses[0]?.permission,).toBe(false,);
  expect(Object.hasOwn(result.uses[0] ?? {}, 'sourceOccurrence',),).toBe(false,);
  expect(result.issues.length,).toBe(1,);
  expect(result.issues[0]?.contribution,).toBe(fixture.contribution.contribution,);
  expect(result.issues[0]?.kind,).toBe('request-contribution-source-association',);
  expect(Object.isFrozen(result.issues[0],),).toBe(true,);
}

await describe({
  name: 'original contribution link requirements',
  children: [
    ...contributionProfiles.flatMap(function originalEdges(profile,) {
      return [
        it({
          name: `${profile} rejects copied source input`,
          fn: async function copiedSource() {
            const f = createContributionFixture(profile,);
            f.association.source = { ...f.source, };
            expectUnresolved(f,);
          },
        },),
        it({
          name: `${profile} rejects foreign source occurrence`,
          fn: async function foreignOccurrence() {
            const f = createContributionFixture(profile,);
            f.association.sourceOccurrence = {};
            expectUnresolved(f,);
          },
        },),
      ];
    },),
    ...(['base', 'base-without-carrier',] as const).map(function baseCase(profile,) {
      return it({
        name: `${profile} requires original run-carrier membership`,
        fn: async function baseMembership() {
          const f = createContributionFixture(profile,);
          f.inputs.runInstructionCarriers = [{ ...f.runCarrier, },];
          expectUnresolved(f,);
          f.inputs.runInstructionCarriers = [f.runCarrier,];
          f.runCarrier.sourceOccurrences = [];
          expectUnresolved(f,);
        },
      },);
    },),
    it({
      name: 'base source carrier must be original and refer to the original source',
      fn: async function sourceCarrier() {
        const f = createContributionFixture('base',);
        f.inputs.instructionCarriers = [{ ...f.carrier, },];
        expectUnresolved(f,);
        f.inputs.instructionCarriers = [f.carrier,];
        f.carrier.source = { ...f.source, };
        expectUnresolved(f,);
      },
    },),
    ...contributionProfiles.filter(function runProfile(profile,) { return !profile.startsWith('base',); },).map(function runCase(profile,) {
      return it({
        name: `${profile} requires original captured run and original source run occurrence`,
        fn: async function runMembership() {
          const f = createContributionFixture(profile,);
          f.association.run = { ...f.run, };
          expectUnresolved(f,);
          f.association.run = f.run;
          f.source.runOccurrence = {};
          expectUnresolved(f,);
        },
      },);
    },),
    ...(['handler', 'expanded', 'ancestor-handler', 'ancestor-expanded',] as const).map(function emittedCase(profile,) {
      return it({
        name: `${profile} requires original emitting run and matching publication identities`,
        fn: async function emittedMembership() {
          const f = createContributionFixture(profile,);
          f.association.emittingRun = { ...f.emitting, };
          expectUnresolved(f,);
          f.association.emittingRun = f.emitting;
          f.publication.sourceOccurrence = {};
          expectUnresolved(f,);
          f.publication.sourceOccurrence = f.source.occurrence;
          f.publication.runOccurrence = {};
          expectUnresolved(f,);
        },
      },);
    },),
    ...(['retained-handler', 'retained-expanded',] as const).map(function retainedCase(profile,) {
      return it({
        name: `${profile} requires original history membership and a defined run identity`,
        fn: async function retainedMembership() {
          const f = createContributionFixture(profile,);
          f.run.retainedMessageOrigins = [{ ...f.retained, },];
          expectUnresolved(f,);
          f.run.retainedMessageOrigins = [f.retained,];
          f.view.retainedMessageOrigin = { ...f.retained, };
          expectUnresolved(f,);
          f.view.retainedMessageOrigin = f.retained;
          f.retained.runOccurrence = undefined;
          f.source.runOccurrence = undefined;
          f.publication.runOccurrence = undefined;
          expectUnresolved(f,);
        },
      },);
    },),
    ...[null, undefined,].map(function noAssociation(association, index,) {
      return it({
        name: `missing association ${index} retains the original unresolved contribution`,
        fn: async function missingAssociation() {
          const f = createContributionFixture('base',);
          f.contribution.association = association;
          expectUnresolved(f,);
        },
      },);
    },),
  ],
},);
await flushPolicyDiagnostics();

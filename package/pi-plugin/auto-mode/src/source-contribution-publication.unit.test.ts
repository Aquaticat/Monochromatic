/**
 Built contribution profiles require the original publications and supported native observations.

 @module
 */
import { consumeSourceAssociations, flushPolicyDiagnostics, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { contributionProfiles, createContributionFixture, } from './source-contribution-test-fixture.ts';

await describe({
  name: 'original contribution publications',
  children: [
    ...contributionProfiles.filter(function published(profile,) { return !profile.startsWith('base',); },).map(function publicationCase(profile,) {
      return it({
        name: `${profile} rejects copied publication`,
        fn: async function copiedPublication() {
          const f = createContributionFixture(profile,);
          f.association.publication = { ...f.publication, };
          f.association.forcedPublication = { ...f.publication, };
          f.association.handlerPublication = { ...f.publication, };
          f.association.expandedPromptPublication = { ...f.publication, };
          expect(consumeSourceAssociations(f.inputs,).uses[0]?.state,).toBe('unresolved',);
          delete f.association.publication;
          delete f.association.forcedPublication;
          delete f.association.handlerPublication;
          delete f.association.expandedPromptPublication;
          expect(consumeSourceAssociations(f.inputs,).uses[0]?.state,).toBe('unresolved',);
        },
      },);
    },),
    ...(['default-preamble', 'default-rule', 'prompt-guideline', 'tool-guideline',] as const).map(function renderCase(profile,) {
      return it({
        name: `${profile} requires original render and insertion observations`,
        fn: async function renderIdentity() {
          const f = createContributionFixture(profile,); const render = f.run.renderOccurrence;
          if (render === undefined) throw new Error('Generated contribution fixture requires its original render');
          f.source.renderOccurrence = {};
          expect(consumeSourceAssociations(f.inputs,).uses[0]?.state,).toBe('unresolved',);
          f.source.renderOccurrence = render;
          f.publication.renderOccurrence = {};
          expect(consumeSourceAssociations(f.inputs,).uses[0]?.state,).toBe('unresolved',);
          f.publication.renderOccurrence = render;
          delete f.run.renderOccurrence;
          delete f.source.renderOccurrence;
          delete f.publication.renderOccurrence;
          expect(consumeSourceAssociations(f.inputs,).uses[0]?.state,).toBe('unresolved',);
          f.run.renderOccurrence = render;
          f.source.renderOccurrence = render;
          f.publication.renderOccurrence = render;
          if (profile !== 'default-preamble') {
            f.source.nativeRuleInsertion = 'not-inserted';
            expect(consumeSourceAssociations(f.inputs,).uses[0]?.state,).toBe('unresolved',);
          }
        },
      },);
    },),
    ...(['section', 'snippet', 'skill', 'default-preamble',] as const).map(function locationCase(profile,) {
      return it({
        name: `${profile} rejects unsupported input locations`,
        fn: async function locationProfile() {
          const f = createContributionFixture(profile,);
          f.source.inputLocation = { field: 'unsupported', slot: 'unsupported', };
          expect(consumeSourceAssociations(f.inputs,).uses[0]?.state,).toBe('unresolved',);
        },
      },);
    },),
    ...(['handler', 'expanded',] as const).map(function retainedCase(kind,) {
      return it({
        name: `${kind} ancestry and retained history stay separate`,
        fn: async function separateOrigins() {
          const active = createContributionFixture(kind === 'handler' ? 'ancestor-handler' : 'ancestor-expanded',);
          active.run.ancestors = [];
          expect(consumeSourceAssociations(active.inputs,).uses[0]?.state,).toBe('unresolved',);
          const history = createContributionFixture(kind === 'handler' ? 'retained-handler' : 'retained-expanded',);
          expect(history.run.ancestors,).toEqual([],);
          expect(consumeSourceAssociations(history.inputs,).uses[0]?.state,).toBe('accounted',);
          history.retained.publication = { ...history.publication, };
          expect(consumeSourceAssociations(history.inputs,).uses[0]?.state,).toBe('unresolved',);
          history.retained.publication = history.publication;
          history.retained.source = { ...history.source, };
          expect(consumeSourceAssociations(history.inputs,).uses[0]?.state,).toBe('unresolved',);
        },
      },);
    },),
    it({
      name: 'original error identity retains cause and diagnostic name',
      fn: async function errorIdentity() {
        const { PolicyInputBindingError, } = await import('@monochromatic-dev/pi-plugin-auto-mode');
        const cause = {}; const error = new PolicyInputBindingError('original binding failed', { cause, },);
        expect(error.name,).toBe('PolicyInputBindingError',);
        expect(error.cause,).toBe(cause,);
      },
    },),
  ],
},);
await flushPolicyDiagnostics();

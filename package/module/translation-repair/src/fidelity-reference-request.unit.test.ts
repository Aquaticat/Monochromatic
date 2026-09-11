import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { FidelityReferenceError, type FidelityReferenceSpec, reviewedFidelityRequest, } from '../dist/final/node/index.mjs';
import { reviewedFixture, } from './fidelity-reference.test-fixture.ts';

/** Metadata-only request whose corpus inputs belong to this invented reviewed fixture. */
function requestFixture(): { readonly spec: FidelityReferenceSpec;
  readonly request: Parameters<typeof reviewedFidelityRequest>[0] } {
  const { spec } = reviewedFixture();
  return { spec, request: { specs: [spec], corpusSha: spec.corpusSha, onlyEntryIds: [],
    damageKinds: ['deletion'], judgeModelIds: ['independent-judge'], cap: 0, withContext: false } };
}

await describe({
  name: '',
  children: [
    it({
      name: 'allows metadata-only preflight and a fixed positive trial cap',
      fn: async () => {
        const { spec, request } = requestFixture();
        expect(reviewedFidelityRequest(request)).toEqual([spec]);
        expect(reviewedFidelityRequest({ ...request, cap: 12 })).toEqual([spec]);
      },
    }),
    ...[-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY].map(cap => it({
      name: `rejects invalid trial cap ${String(cap)} before corpus or provider work`,
      fn: async () => {
        const { request } = requestFixture();
        expect(() => reviewedFidelityRequest({ ...request, cap })).toThrow(FidelityReferenceError);
      },
    })),
    ...[[], ['judge', 'judge'], [''], [' ']].map(judgeModelIds => it({
      name: `rejects an empty or duplicate judging identity ${JSON.stringify(judgeModelIds)}`,
      fn: async () => {
        const { request } = requestFixture();
        expect(() => reviewedFidelityRequest({ ...request, judgeModelIds })).toThrow(FidelityReferenceError);
      },
    })),
    ...['fixture-author', 'provider/fixture-author'].map(author => it({
      name: `does not let correction author ${author} judge a nominally disinterested fixture`,
      fn: async () => {
        const { request } = requestFixture();
        expect(() => reviewedFidelityRequest({ ...request, judgeModelIds: [author] })).toThrow(FidelityReferenceError);
      },
    })),
    it({
      name: 'does not conflate a different author name with an explicit overlap',
      fn: async () => {
        const { spec, request } = requestFixture();
        expect(reviewedFidelityRequest({ ...request, judgeModelIds: ['other-fixture-author'] })).toEqual([spec]);
      },
    }),
    it({
      name: 'refuses a mixed request when only one requested damage family is reviewed',
      fn: async () => {
        const { spec, request } = requestFixture();
        expect(() => reviewedFidelityRequest({ ...request, specs: [{ ...spec,
          damages: spec.damages.filter(damage => damage.kind === 'deletion') }],
          damageKinds: ['deletion', 'alteration'] })).toThrow(FidelityReferenceError);
      },
    }),
    it({
      name: 'requires requested context and damage selection to be reviewed',
      fn: async () => {
        const { spec, request } = requestFixture();
        expect(() => reviewedFidelityRequest({ ...request, withContext: true })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityRequest({ ...request, damageKinds: [] })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityRequest({ ...request, damageKinds: ['deletion', 'deletion'] })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityRequest({ ...request, specs: [{ ...spec,
          damages: spec.damages.filter(damage => damage.kind === 'deletion') }], damageKinds: ['alteration'] }))
          .toThrow(FidelityReferenceError);
      },
    }),
    it({
      name: 'does not report successful zero-call metadata preflight for a different corpus revision',
      fn: async () => {
        const { request } = requestFixture();
        expect(() => reviewedFidelityRequest({ ...request, corpusSha: 'different-pin' })).toThrow(FidelityReferenceError);
      },
    }),
  ],
});

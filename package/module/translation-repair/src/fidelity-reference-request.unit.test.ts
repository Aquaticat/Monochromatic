import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { FidelityReferenceError, reviewedFidelityRequest, } from '../dist/final/node/index.mjs';
import { reviewedFixture, } from './fidelity-reference.test-fixture.ts';

await describe({
  name: '',
  children: [
    it({
      name: 'allows metadata-only preflight and a fixed positive trial cap',
      fn: async () => {
        const { spec } = reviewedFixture();
        const request = { specs: [spec], onlyEntryIds: [], damageKinds: ['deletion'] as const,
          judgeModelIds: ['independent-judge'], withContext: false };
        expect(reviewedFidelityRequest({ ...request, cap: 0 })).toEqual([spec]);
        expect(reviewedFidelityRequest({ ...request, cap: 12 })).toEqual([spec]);
      },
    }),
    ...[-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY].map(cap => it({
      name: `rejects invalid trial cap ${String(cap)} before corpus or provider work`,
      fn: async () => {
        const { spec } = reviewedFixture();
        expect(() => reviewedFidelityRequest({ specs: [spec], onlyEntryIds: [], damageKinds: ['deletion'],
          judgeModelIds: ['independent-judge'], withContext: false, cap })).toThrow(FidelityReferenceError);
      },
    })),
    ...[[], ['judge', 'judge'], [''], [' ']].map(judgeModelIds => it({
      name: `rejects an empty or duplicate judging identity ${JSON.stringify(judgeModelIds)}`,
      fn: async () => {
        const { spec } = reviewedFixture();
        expect(() => reviewedFidelityRequest({ specs: [spec], onlyEntryIds: [], damageKinds: ['deletion'],
          judgeModelIds, withContext: false, cap: 0 })).toThrow(FidelityReferenceError);
      },
    })),
    ...['fixture-author', 'provider/fixture-author'].map(author => it({
      name: `does not let correction author ${author} judge a nominally disinterested fixture`,
      fn: async () => {
        const { spec } = reviewedFixture();
        expect(() => reviewedFidelityRequest({ specs: [spec], onlyEntryIds: [], damageKinds: ['deletion'],
          judgeModelIds: [author], withContext: false, cap: 0 })).toThrow(FidelityReferenceError);
      },
    })),
    it({
      name: 'does not conflate a different author name with an explicit overlap',
      fn: async () => {
        const { spec } = reviewedFixture();
        expect(reviewedFidelityRequest({ specs: [spec], onlyEntryIds: [], damageKinds: ['deletion'],
          judgeModelIds: ['other-fixture-author'], withContext: false, cap: 0 })).toEqual([spec]);
      },
    }),
    it({
      name: 'requires requested context and damage selection to be reviewed',
      fn: async () => {
        const { spec } = reviewedFixture();
        const request = { specs: [spec], onlyEntryIds: [], judgeModelIds: ['judge'], cap: 0 };
        expect(() => reviewedFidelityRequest({ ...request, damageKinds: ['deletion'], withContext: true })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityRequest({ ...request, damageKinds: [], withContext: false })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityRequest({ ...request, damageKinds: ['deletion', 'deletion'], withContext: false })).toThrow(FidelityReferenceError);
        expect(() => reviewedFidelityRequest({ ...request, specs: [{ ...spec,
          damages: spec.damages.filter(damage => damage.kind === 'deletion') }],
          damageKinds: ['alteration'], withContext: false })).toThrow(FidelityReferenceError);
      },
    }),
  ],
});

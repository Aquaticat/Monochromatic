/**
 Tests for retirement log wording.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  formatAbstentions,
  formatLiveModelWarning,
  formatPlanningSummary,
  formatRetirementLine,
} from './retirement-report.ts';
import type { AbstentionCounts, } from './retirement-rule.ts';

//region Fixtures

/**
 * Build an abstention tally with only the given reasons set.
 *
 * @param overrides - reasons to set, all others zero
 *
 * @returns tally with every reason present
 */
function tally(overrides: Partial<AbstentionCounts>,): AbstentionCounts {
  return {
    keeperAmbiguity: 0,
    unorderedPair: 0,
    loserNewerThanKeeper: 0,
    versionlessProtected: 0,
    duplicateIdentity: 0,
    ...overrides,
  };
}

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: formatRetirementLine.name,
      children: [
        it({
          name: 'names the provider, the retired id, and the keeper',
          fn: async function runRetirementLine() {
            expect(formatRetirementLine({
              retirement: {
                provider: 'hyper',
                api: 'openai-completions',
                retiredId: 'glm-5.2',
                keeperId: 'glm-5.3',
              },
            },),).toBe('retired hyper/glm-5.2 in favor of glm-5.3',);
          },
        },),
      ],
    },),
    describe({
      name: formatAbstentions.name,
      children: [
        it({
          name: 'says nothing was declined when every reason is zero',
          fn: async function runEmptyTally() {
            expect(formatAbstentions({ abstentions: tally({},), },),).toBe('declined nothing',);
          },
        },),
        it({
          name: 'lists non-zero reasons in a fixed order',
          fn: async function runOrderedTally() {
            expect(formatAbstentions({
              abstentions: tally({ versionlessProtected: 3, keeperAmbiguity: 1, unorderedPair: 2, },),
            },),).toBe('declined keeperAmbiguity=1 unorderedPair=2 versionlessProtected=3',);
          },
        },),
        it({
          name: 'omits reasons that did not occur',
          fn: async function runPartialTally() {
            expect(formatAbstentions({
              abstentions: tally({ duplicateIdentity: 1, },),
            },),).toBe('declined duplicateIdentity=1',);
          },
        },),
      ],
    },),
    describe({
      name: formatPlanningSummary.name,
      children: [
        it({
          name: 'reports counts of retired models and re-registered providers',
          fn: async function runSummary() {
            expect(formatPlanningSummary({
              planning: {
                plans: [{ provider: 'hyper', models: [], retirements: [], }],
                retirements: [
                  {
                    provider: 'hyper',
                    api: 'openai-completions',
                    retiredId: 'glm-5.2',
                    keeperId: 'glm-5.3',
                  },
                ],
                abstentions: tally({ unorderedPair: 1, },),
              },
            },),).toBe('retired 1 models across 1 providers; declined unorderedPair=1',);
          },
        },),
        it({
          name: 'reports an empty pass without a provider count',
          fn: async function runEmptySummary() {
            expect(formatPlanningSummary({
              planning: { plans: [], retirements: [], abstentions: tally({},), },
            },),).toBe('retired 0 models across 0 providers; declined nothing',);
          },
        },),
      ],
    },),
    describe({
      name: formatLiveModelWarning.name,
      children: [
        it({
          name: 'names the live model, the successor, and the inaction',
          fn: async function runLiveWarning() {
            expect(formatLiveModelWarning({
              retirement: {
                provider: 'opencode-go',
                api: 'openai-completions',
                retiredId: 'glm-5.2',
                keeperId: 'glm-5.3',
              },
            },),).toBe(
              'session model opencode-go/glm-5.2 is retired in favor of glm-5.3; leaving the session on it',
            );
          },
        },),
      ],
    },),
  ],
},);

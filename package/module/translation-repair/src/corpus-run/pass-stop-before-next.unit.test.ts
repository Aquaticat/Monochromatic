/**
 * Tests for the scheduler's stop rule: the soft wall-clock budget and the
 * per-run spend ceiling, asked before each entry.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  noteRunSpend,
  resetRunSpend,
  SPEND_CEILING_PROVIDER,
  stopBeforeNextEntry,
} from '../../dist/final/node/index.mjs';

/**
 * A soft budget no case here reaches by time.
 */
const ROOMY_BUDGET_MS = 1_000_000;

await describe({
  name: stopBeforeNextEntry.name,
  children: [
    it({
      name: 'LETS the next entry start while the run is inside both its time budget and its allowance',
      fn: async () => {
        resetRunSpend();
        noteRunSpend({
          provider: SPEND_CEILING_PROVIDER,
          costUsd: 4.5,
        },);
        expect(stopBeforeNextEntry({
          elapsedMs: 10,
          softBudgetMs: ROOMY_BUDGET_MS,
          ceilingUsd: 20,
        },),).toBe(false,);
        resetRunSpend();
      },
    },),
    it({
      name: 'STOPS on the soft budget, whatever has been spent',
      fn: async () => {
        resetRunSpend();
        expect(stopBeforeNextEntry({
          elapsedMs: ROOMY_BUDGET_MS,
          softBudgetMs: ROOMY_BUDGET_MS,
          ceilingUsd: 20,
        },),).toBe(true,);
      },
    },),
    it({
      name: 'STOPS once the run has spent its allowance on the metered provider, and NOT on what another '
        + 'provider spent (the owner\'s per-run ceiling of 2026-09-04)',
      fn: async () => {
        resetRunSpend();
        noteRunSpend({
          provider: 'hyper',
          costUsd: 100,
        },);
        expect(stopBeforeNextEntry({
          elapsedMs: 10,
          softBudgetMs: ROOMY_BUDGET_MS,
          ceilingUsd: 20,
        },),).toBe(false,);
        noteRunSpend({
          provider: SPEND_CEILING_PROVIDER,
          costUsd: 20,
        },);
        expect(stopBeforeNextEntry({
          elapsedMs: 10,
          softBudgetMs: ROOMY_BUDGET_MS,
          ceilingUsd: 20,
        },),).toBe(true,);
        resetRunSpend();
      },
    },),
    it({
      name: 'STOPS before the first entry under a ceiling of zero, which is how the guard is proven live',
      fn: async () => {
        resetRunSpend();
        expect(stopBeforeNextEntry({
          elapsedMs: 0,
          softBudgetMs: ROOMY_BUDGET_MS,
          ceilingUsd: 0,
        },),).toBe(true,);
      },
    },),
  ],
},);

/**
 Tests for the scheduler's stop rule: the soft time budget and the
 per-run spend ceiling, asked before each entry.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  noteRunSpend,
  resetRunSpend,
} from '@monochromatic-dev/translation-repair-shared-contract';
import { stopBeforeNextEntry, } from '../../dist/final/node/index.mjs';

/**
 A soft budget no case here reaches by time.
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
          provider: 'openrouter',
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
          provider: 'openrouter',
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
      name: 'STOPS once the run has spent its allowance on Xiaomi, which no balance bounds and which takes the seat '
        + 'OpenRouter\'s ceiling used to bound, and LETS entries start below it',
      fn: async () => {
        resetRunSpend();
        noteRunSpend({
          provider: 'xiaomi',
          costUsd: 19.99,
        },);
        expect(stopBeforeNextEntry({
          elapsedMs: 10,
          softBudgetMs: ROOMY_BUDGET_MS,
          ceilingUsd: 20,
        },),).toBe(false,);
        noteRunSpend({
          provider: 'xiaomi',
          costUsd: 0.01,
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
      name: 'STOPS once the run has spent its allowance on DeepSeek, each provider against the ceiling alone, '
        + 'so spend split across providers below the ceiling each does not stop the run',
      fn: async () => {
        resetRunSpend();
        noteRunSpend({
          provider: 'xiaomi',
          costUsd: 12,
        },);
        noteRunSpend({
          provider: 'deepseek',
          costUsd: 12,
        },);
        noteRunSpend({
          provider: 'openrouter',
          costUsd: 12,
        },);
        expect(stopBeforeNextEntry({
          elapsedMs: 10,
          softBudgetMs: ROOMY_BUDGET_MS,
          ceilingUsd: 20,
        },),).toBe(false,);
        noteRunSpend({
          provider: 'deepseek',
          costUsd: 8,
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

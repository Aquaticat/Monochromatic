/**
 * Tests for trust directive extraction from custom session entries.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { getTrustDirectives, } from './context.ts';
import { TRUST_ENTRY_TYPE, } from './types.ts';

/** First trust directive fixture. */
const FIRST_TRUST_RULE = 'Allow .env file access';

/** Second trust directive fixture. */
const SECOND_TRUST_RULE = 'Allow terraform plan';

/** Minimal session branch entry shape consumed by trust-directive tests. */
type MockBranchEntry = {
  /** Session entry discriminator. */
  readonly type: string;
  /** Extension custom entry discriminator. */
  readonly customType?: string;
  /** Optional custom entry payload. */
  readonly data?: unknown;
};

/**
 * Create mock extension context with session branch access.
 *
 * @param branch - branch entries returned from session manager
 *
 * @returns mock extension context
 *
 * @example
 * ```typescript
 * const ctx = contextFromBranch({ branch: [trustEntry({ rule: FIRST_TRUST_RULE })] });
 * ```
 */
function contextFromBranch(
  {
    branch,
  }: {
    readonly branch: readonly MockBranchEntry[];
  },
): ExtensionContext {
  return {
    sessionManager: {
      getBranch() {
        return branch;
      },
    },
  } as unknown as ExtensionContext;
}

/**
 * Build trust-directive custom entry matching Pi appendEntry storage.
 *
 * @param rule - active trust directive text
 *
 * @returns mock trust-directive branch entry
 *
 * @example
 * ```typescript
 * trustEntry({ rule: FIRST_TRUST_RULE });
 * ```
 */
function trustEntry(
  {
    rule,
  }: {
    readonly rule: string;
  },
): MockBranchEntry {
  return {
    type: 'custom',
    customType: TRUST_ENTRY_TYPE,
    data: rule,
  };
}

/**
 * Build trust-directive reset custom entry matching Pi appendEntry storage.
 *
 * @returns mock reset branch entry
 *
 * @example
 * ```typescript
 * trustResetEntry();
 * ```
 */
function trustResetEntry(): MockBranchEntry {
  return {
    type: 'custom',
    customType: TRUST_ENTRY_TYPE,
    data: null,
  };
}

await describe({
  name: getTrustDirectives.name,
  children: [
    it({
      name: 'reads active trust directives from custom entries',
      fn: async function readsActiveTrustDirectivesFromCustomEntries(): Promise<void> {
        /** Active trust directives extracted from real custom-entry shape. */
        const directives = getTrustDirectives(
          contextFromBranch({
            branch: [
              trustEntry({ rule: FIRST_TRUST_RULE, },),
              trustEntry({ rule: SECOND_TRUST_RULE, },),
            ],
          },),
        );

        expect(directives,).toEqual([
          FIRST_TRUST_RULE,
          SECOND_TRUST_RULE,
        ],);
      },
    },),
    it({
      name: 'clears prior trust directives after reset custom entry',
      fn: async function clearsPriorTrustDirectivesAfterResetCustomEntry(): Promise<void> {
        /** Active trust directives after reset sentinel appears in session history. */
        const directives = getTrustDirectives(
          contextFromBranch({
            branch: [
              trustEntry({ rule: FIRST_TRUST_RULE, },),
              trustResetEntry(),
              trustEntry({ rule: SECOND_TRUST_RULE, },),
            ],
          },),
        );

        expect(directives,).toEqual([SECOND_TRUST_RULE,],);
      },
    },),
  ],
},);

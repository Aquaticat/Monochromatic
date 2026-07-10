/**
 * Unified built-in require-root policy.
 *
 * @module
 */

import { definePolicy, } from '../api/authoring.ts';
import type {
  PolicyDefinition,
  PolicyFinding,
} from '../api/policy-types.ts';
import {
  requireRoot,
  RequireRootViolationError,
} from '../rules/require-root.ts';

/**
 * Configurable require-root built-in.
 *
 * @example
 * ```ts
 * requireRootPolicy.name;
 * ```
 */
export const requireRootPolicy: PolicyDefinition<undefined, 'require-root'> = definePolicy({
  name: 'require-root',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: [
    'pre-forward',
    'direct-check',
  ],
  check: async function checkRequireRoot({ context, }): Promise<readonly PolicyFinding[]> {
    try {
      await requireRoot(context.command
        .rawArgs,);
      return [];
    }
    catch (error: unknown) {
      if (error instanceof RequireRootViolationError) {
        return [{
          code: 'not-at-root',
          message: error.message,
        },];
      }
      throw error;
    }
  },
},);

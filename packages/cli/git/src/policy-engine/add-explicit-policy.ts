/**
 * Unified add-explicit built-in policy. @module
 */
import type { PolicyFinding, } from '../api/policy-types.ts';
import {
  addExplicit,
  AddExplicitViolationError,
} from '../rules/add-explicit.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 * Configurable add-explicit policy.
 *
 * @example
 * ```ts
 * addExplicitPolicy.name;
 * ```
 */
export const addExplicitPolicy: RuntimePolicyDefinition = {
  name: 'add-explicit',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: ['pre-forward',],
  check: function checkAddExplicit({ context, }): Promise<readonly PolicyFinding[]> {
    try {
      addExplicit(context.command
        .transformedArgs,);
      return Promise.resolve([],);
    }
    catch (error: unknown) {
      if (error instanceof AddExplicitViolationError) {
        return Promise.resolve([{
          code: 'bulk-add-rejected',
          message: error.message,
        },],);
      }
      throw error;
    }
  },
};

/**
 Track factory flow and cleanup obligations without duplicating manager or session registries.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { RootSessionScope } from '../../integration/native-batch/session-root-types.ts';
import { createConstructionScope } from './construction.ts';
import { RuntimeOperationError } from './error.mjs';
import type { FactoryScopeDefinition, FactoryScopeInput, FactoryScopes } from './types.ts';

/** Factory diagnostics describe flow without serializing native capabilities. */
const l = tagged({ tag: 'auto-mode-runtime-factory-scopes' });

//region All construction scopes share pending cleanup and synchronous exclusion

/**
 Keep abandoned construction cleanup ahead of subsequent SDK creation.

 @param definition - original lifecycle, native readers, result validator, and disposal callback
 @returns factory-owned construction and cleanup capabilities
 @throws RuntimeOperationError when required capabilities are absent or callbacks reenter
 @throws AggregateError when retained cleanup obligations fail again
 */
export function createRuntimeFactoryScopes(definition: FactoryScopeDefinition): FactoryScopes {
  if ((typeof definition.lifecycle?.beginConstruction !== 'function')
    || (typeof definition.lifecycle?.abandonConstruction !== 'function')
    || (typeof definition.readManager !== 'function')
    || (typeof definition.assertRuntimeResult !== 'function')
    || (typeof definition.disposeSession !== 'function')
    || (typeof definition.prepareResult !== 'function'))
    throw new RuntimeOperationError('Construction lifecycle, native readers and native disposal are required');
  /** Cleanup callbacks retain exact failed construction occurrences until successful disposal. */
  const pendingCleanup = new Set<() => void>();
  /** Synchronous callback exclusion spans every scope issued by this factory. */
  const activity = { busy: false };
  /** Nested operations retain their factory diagnostic boundary. */
  const fl = tagged({ tag: createRuntimeFactoryScopes.name, l });

  /** Always release the reentrancy guard, including when a callback throws. */
  function exclusive<Result>(body: () => Result): Result {
    if (activity.busy)
      throw new RuntimeOperationError('Factory scope operations cannot reenter through callbacks');
    activity.busy = true;
    try {
      return body();
    } finally {
      activity.busy = false;
    }
  }

  /** Reserve a new occurrence only when prior abandoned cleanup has completed. */
  function begin(input: FactoryScopeInput): RootSessionScope {
    if (pendingCleanup.size > 0)
      throw new RuntimeOperationError('Failed construction cleanup is pending; retry cleanup before constructing another runtime');
    tagged({ tag: begin.name, l: fl }).debug('starting owned factory construction');
    return createConstructionScope({ definition, input, pendingCleanup, exclusive });
  }

  /** Retry every retained obligation and preserve each thrown failure. */
  function retryCleanup(): void {
    /** Failure aggregation does not discard successful cleanup of other occurrences. */
    const failures: unknown[] = [];
    for (const cleanup of [...pendingCleanup]) {
      try {
        cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0)
      throw new AggregateError(failures, 'Failed construction cleanup remains pending');
    tagged({ tag: retryCleanup.name, l: fl }).debug('all retained construction cleanup completed');
  }
  return Object.freeze({
    /** {@inheritDoc begin} */
    begin(input: FactoryScopeInput): RootSessionScope {
      return exclusive(function beginFactoryOccurrence() { return begin(input); });
    },
    /** {@inheritDoc retryCleanup} */
    retryCleanup(): void { exclusive(retryCleanup); },
    /** Inspect pending obligations without creating construction authority. */
    diagnostics(): { readonly pendingCleanup: number } {
      return Object.freeze({ pendingCleanup: pendingCleanup.size });
    },
  });
}

//endregion All construction scopes share pending cleanup and synchronous exclusion

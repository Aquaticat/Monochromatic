/**
 Track factory flow and cleanup obligations without duplicating manager or session registries.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { RootSessionScope } from '../../integration/native-batch/session-root-types.ts';
import { createConstructionScope } from './construction.ts';
import { RuntimeOperationError } from './error.mjs';
import type {
  FactoryScopeDefinition,
  FactoryScopeInput,
  FactoryScopes
} from './types.ts';

/**
 Factory diagnostics describe flow without serializing native capabilities.
 */
const l = tagged({ tag: 'auto-mode-runtime-factory-scopes' });

//region All construction scopes share pending cleanup and synchronous exclusion

/**
 Keep abandoned construction cleanup ahead of subsequent SDK creation.

 @param definition - original lifecycle, native readers, result validator, and disposal callback
 
 @returns factory-owned construction and cleanup capabilities
 
 @throws RuntimeOperationError when required capabilities are absent or callbacks reenter
 
 @throws AggregateError when retained cleanup obligations fail again

 @example
 ```ts
 const scopes = createRuntimeFactoryScopes(nativeDefinition);
 const scope = scopes.begin({ manager });
 ```
 */
export function createRuntimeFactoryScopes(definition: FactoryScopeDefinition): FactoryScopes {
  /**
   Capture original capabilities once before callers can replace option properties.
   */
  const {
    lifecycle,
    readManager,
    prepareResult,
    assertRuntimeResult,
    disposeSession
  } = definition;
  /**
   Each occurrence retains the same callback identities selected at bootstrap.
   */
  const bindings = Object.freeze({
    lifecycle,
    readManager,
    prepareResult,
    assertRuntimeResult,
    disposeSession
  });
  if (((typeof bindings.lifecycle
    ?.beginConstruction) !== 'function')
    || ((typeof bindings.lifecycle
      ?.abandonConstruction) !== 'function')
    || ((typeof bindings.readManager) !== 'function')
    || ((typeof bindings.assertRuntimeResult) !== 'function')
    || ((typeof bindings.disposeSession) !== 'function')
    || ((typeof bindings.prepareResult) !== 'function'))
    throw new RuntimeOperationError('Construction lifecycle, native readers and native disposal are required');
  /**
   Cleanup callbacks retain exact failed construction occurrences until successful disposal.
   */
  const pendingCleanup = new Set<() => void>();
  /**
   Synchronous callback exclusion spans every scope issued by this factory.
   */
  const activity = { busy: false };
  /**
   Nested operations retain their factory diagnostic boundary.
   */
  const fl = tagged({
    tag: createRuntimeFactoryScopes.name,
    l
  });

  /**
   Always release the reentrancy guard, including when a callback throws.

   @param body - synchronous operation retaining this factory's exclusion
   
   @returns original operation result
   */
  function exclusive<Result>(body: () => Result): Result {
    if (activity.busy)
      throw new RuntimeOperationError('Factory scope operations cannot reenter through callbacks');
    activity.busy = true;
    /**
     Lexical disposal releases exclusion on both return and throw.
     */
    using reservation = {
      [Symbol.dispose]: function releaseFactoryExclusion(): void {
        activity.busy = false;
      },
    };
    return body();
  }

  /**
   Reserve a new occurrence only when prior abandoned cleanup has completed.

   @param input - original manager and optional owned replacement transition
   
   @returns original construction capability
   */
  function begin(input: FactoryScopeInput): RootSessionScope {
    if (pendingCleanup.size > 0)
      throw new RuntimeOperationError('Failed construction cleanup is pending; retry cleanup before constructing another runtime');
    tagged({
      tag: begin.name,
      l: fl
    })
      .debug('starting owned factory construction');
    return createConstructionScope({
      definition: bindings,
      input,
      pendingCleanup,
      exclusive
    });
  }

  /**
   Retry every retained obligation and preserve each thrown failure.
   */
  function retryCleanup(): void {
    /**
     Failure aggregation does not discard successful cleanup of other occurrences.
     */
    const failures: unknown[] = [];
    // Callbacks may remove completed obligations; exclusion prevents additions during this iteration.
    for (const cleanup of pendingCleanup) {
      try {
        cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0)
      throw new AggregateError(
        failures,
        'Failed construction cleanup remains pending'
      );
    tagged({
      tag: retryCleanup.name,
      l: fl
    })
      .debug('all retained construction cleanup completed');
  }
  return Object.freeze({
    /**
     {@inheritDoc begin}
     */
    begin(input: FactoryScopeInput): RootSessionScope {
      return exclusive(function beginFactoryOccurrence() {
        return begin(input);
      });
    },
    /**
     {@inheritDoc retryCleanup}
     */
    retryCleanup(): void { exclusive(retryCleanup); },
    /**
     Inspect pending obligations without creating construction authority.
     */
    diagnostics(): { readonly pendingCleanup: number } {
      return Object.freeze({ pendingCleanup: pendingCleanup.size });
    },
  });
}

//endregion All construction scopes share pending cleanup and synchronous exclusion

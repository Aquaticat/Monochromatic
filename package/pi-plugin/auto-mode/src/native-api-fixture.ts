/**
 Independent instrumentation observes callback identity, failures, and invocation receivers. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import {
  apiModule,
  type FixtureAPICall,
  type FixturePublicAPI
} from './native-api-module-fixture.ts';
import {
  publicKeys,
  selectionKeys
} from './native-api-keys-fixture.ts';

/**
 Recorded calls retain the exact arguments and receiver seen by original owners.
 */
type ObservedCall = Readonly<{
  name: string;
  args: readonly unknown[];
  receiver: unknown
}>;

/**
 Current retained selection exposes independent observable callbacks.
 */
type FixtureSelection = Readonly<{
  inspectBatch: FixtureAPICall;
  inspectClaim: FixtureAPICall
}>;

/**
 Independent mutable controls and built consumer access remain separate.
 */
type APIFixture = Readonly<{
  events: string[];
  calls: ObservedCall[];
  guarded: FixtureAPICall[];
  failures: Map<string, unknown>;
  results: Map<string, unknown>;
  state: { selection: FixtureSelection };
  input: Record<string, unknown>;
  construct: () => FixturePublicAPI;
  method: (input: Readonly<{
    name: string;
    api: FixturePublicAPI
  }>) => FixtureAPICall;
}>;

/**
 Read a named method without inventing a fallback for missing publication.

 @param name - original expected public method

 @param api - built assembled public judgment

 @returns original published callback
 */
function method({ name, api }: Readonly<{ name: string; api: FixturePublicAPI }>): FixtureAPICall {
  return nonNullishOrThrow(api[name]);
}

/**
 Bind independently observed owners without requiring real selection or transport state.

 @returns independent public factory, original functions, and mutable fault controls

 @example createAPIFixture();
 */
export function createAPIFixture(): APIFixture {
  /**
   Ordered events distinguish operation entry, owner calls, and operation exit.
   */
  const events: string[] = [];
  /**
   Every underlying invocation retains original argument cardinality.
   */
  const calls: ObservedCall[] = [];
  /**
   Original callback identity is observable at the operation boundary.
   */
  const guarded: FixtureAPICall[] = [];
  /**
   Failure identity crosses public wrappers without replacement.
   */
  const failures = new Map<string, unknown>();
  /**
   Explicit undefined and asynchronous values remain valid owner results.
   */
  const results = new Map<string, unknown>();
  /**
   Observe a named boundary before any subsequent operation can run.

   @param name - original owner or guard phase being observed
   */
  function step(name: string): void {
    events.push(name);
    if (failures.has(name)) throw failures.get(name);
  }
  /**
   Capture the runtime call without reading opaque arguments.

   @param name - independently recorded owner name

   @returns owner callback with observable result and failure controls
   */
  function owner(name: string): FixtureAPICall {
    /**
     Stable default result distinguishes each owner without matching implementation projections.
     */
    const result = Object.freeze({ name });
    results.set(
      name,
      result
    );
    /**
     Proxy invocation observes the native call argument array without changing caller syntax.

     @returns independently configured original result
     */
    function originalOwner(): unknown {
      return results.get(name);
    }
    return new Proxy(originalOwner, {
      apply(target: FixtureAPICall, receiver: unknown, args: unknown[]): unknown {
        calls.push({ name, args, receiver });
        step(name);
        return Reflect.apply(target, receiver, args);
      }
    });
  }
  /**
   Selection identities can change after assembly without rebuilding the public judgment.
   */
  const state: APIFixture['state'] = { selection: {
    inspectBatch: owner('inspectBatch'),
    inspectClaim: owner('inspectClaim')
  } };
  /**
   Preserve ordinary operation semantics while exposing the exact supplied callback.

   @param run - callback supplied by the public method

   @returns owner result unless the independent guard supplies its own result
   */
  function operation(run: FixtureAPICall): unknown {
    guarded.push(run);
    step('operation:before');
    /**
     Plain callback invocation exposes receiver and argument changes.
     */
    const result = run();
    step('operation:after');
    return results.has('operation') ? results.get('operation') : result;
  }
  /**
   Resolve the current selection only when a public retained inspection asks for it.

   @returns current selection identity
   */
  function knownSelection(): FixtureSelection {
    step('selection');
    return state.selection;
  }
  /**
   Owner callbacks are mutable here so capture timing can be tested independently.
   */
  const input: Record<string, unknown> = {
    operation,
    knownSelection
  };
  for (const name of publicKeys) {
    if (selectionKeys.some(function selectionKey(key) { 
      return key === name; 
    })) continue;
    /**
     Public checkpoint delegates to the original active owner.
     */
    const ownerName = name === 'checkpoint' ? 'active' : name;
    input[ownerName] = owner(ownerName);
  }
  /**
   Publish the built public API after callers finish configuring independent owners.

   @returns original assembled public judgment
   */
  function construct(): FixturePublicAPI { 
    return apiModule.createJudgmentAPI(input); 
  }
  return {
    events,
    calls,
    guarded,
    failures,
    results,
    state,
    input,
    construct,
    method
  };
}

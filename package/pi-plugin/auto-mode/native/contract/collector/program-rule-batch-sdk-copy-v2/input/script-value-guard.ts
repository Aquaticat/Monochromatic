/**
 Native result-binding failures retain their original caught values and call identity.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Result-binding guards remain distinct from ordinary native tool failures

/**
 Native call identity is diagnostic context, never a replacement judgment or budget.
 */
type GuardedResultCall = {
  /**
   Original tool name identifies the affected native invocation.
   */
  readonly name: string;
  /**
   Original call identifier distinguishes repeated tool invocations.
   */
  readonly id: string;
};

/**
 Guard diagnostics preserve caught values without logging their contents.
 */
const l = tagged({ tag: 'auto-mode-native-script-value-guard' });

/**
 Code-owned result-binding failure, distinct from the native tool's ordinary conversion error.
 */
export class NativeScriptValueGuardError extends AggregateError {
  /**
   Preserve the original constructor-based category, including derived guard classes.
   */
  override readonly name: string = this.constructor.name;

  /**
   Owned frozen list retains every original caught value, including nullish and primitive throws.
   */
  override readonly errors: unknown[];

  /**
   Retain caught failures while naming the original call or enclosing program result.

   @param errors - original caught values in occurrence order

   @param call - original native call when the failure is bound to a particular invocation
   */
  constructor({ errors, call }: {
    readonly errors: readonly unknown[];
    readonly call?: GuardedResultCall;
  }) {
    /**
     Only original call metadata enters the diagnostic; captured result content stays separate.
     */
    const input = call ? `tool ${JSON.stringify(call.name)} call ${JSON.stringify(call.id)}` : 'original program result';
    /**
     The list is owned here so freezing it never freezes a caller's collection or caught values.
     */
    const failures = [...errors];
    super(failures, `Native result binding for ${input} was rejected. Resolve the original source, lifetime, ownership or supported-value failure; do not replace its judgment with a fresh budget.`);
    this.errors = failures;
    Object.freeze(failures);
  }
}

/**
 Preserve an existing guard occurrence or bind one original caught value to its native result boundary.

 @param error - original thrown value, retained without replacing its identity

 @param call - original native call when available

 @returns original guard or new aggregate containing exactly the original caught value

 @example
 ```ts
 const guard = scriptValueGuard({ error: caught, call: { name: 'read', id: 'original-call' } });
 ```
 */
export function scriptValueGuard({ error, call }: {
  readonly error: unknown;
  readonly call?: GuardedResultCall;
}): NativeScriptValueGuardError {
  /**
   Distinguish original guard propagation from newly caught result failures.
   */
  const rl = tagged({ tag: scriptValueGuard.name, l });
  if (error instanceof NativeScriptValueGuardError) {
    rl.debug('retaining original result-binding guard');
    return error;
  }
  rl.debug('binding original caught value to a native result guard');
  return new NativeScriptValueGuardError({ errors: [error], ...(call === undefined ? {} : { call }) });
}

//endregion Result-binding guards remain distinct from ordinary native tool failures

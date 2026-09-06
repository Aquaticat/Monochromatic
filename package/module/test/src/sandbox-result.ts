/**
 Guard returned capabilities that can later reinstall target state. @module
 */
import { SandboxOwnershipError, } from './sandbox-error.ts';
import {
  guardSandboxCapability,
  invokeSandboxMethod,
  type SandboxInvocation,
} from './sandbox-guard.ts';
import {
  requireRunningOwner,
  type SandboxOwner,
} from './sandbox-owner.ts';
import {
  isSandboxTarget,
  requireUnownedProperty,
  sandboxPropertyKey,
  SINON_VALIDATES_PROPERTY,
} from './sandbox-target.ts';

/**
 Guards target-mutating fake configuration while preserving the original fake's identity.
 Pure behavior and history configuration remain ordinary Sinon operations after completion.

 @param value - original factory result
 
 @param owner - attempt that created the result
 
 @param restoring - whether runner-owned restoration is currently in progress
 
 @param target - actual target for noncontextual fakes, or the private contextual facade
 
 @param key - property that deferred descriptor configuration would mutate
 
 @example
 ```ts
 guardFakeMutators({ value, owner, restoring, target, key });
 ```
 */
export function guardFakeMutators({
  value,
  owner,
  restoring,
  target,
  key,
}: {
  readonly value: unknown;
  readonly owner: SandboxOwner;
  readonly restoring: () => boolean;
  readonly target?: object;
  readonly key?: PropertyKey;
},): void {
  if (!isSandboxTarget(value,))
    return;
  /** A restored generation cannot regain descriptor-changing authority. */
  const generation = { restored: false, };
  for (const operation of [
    'get',
    'set',
    'value',
    'restore',
  ] as const) {
    /**
     Read only the known Sinon target-mutating capabilities, not arbitrary object members.
     */
    const method: unknown = Reflect.get(
      value,
      operation,
    );
    if ((typeof method) !== 'function')
      continue;
    Reflect.set(
      value,
      operation,
      new Proxy(
        method,
        {
      apply(
        original: typeof method,
        receiver: unknown,
        args: unknown[],
      ): unknown {
        if (operation === 'restore') {
          if (generation.restored || ((owner.phase === 'completed') && (!restoring())))
            return undefined;
        }
        else {
          requireRunningOwner({
            owner,
            operation: `Sinon fake.${operation}`,
          },);
          if (generation.restored)
            throw new SandboxOwnershipError(`Sinon fake.${operation} belongs to a restored replacement. Create a new fake instead.`,);
          if ((target !== undefined) && (key !== undefined))
            requireUnownedProperty({
              target,
              key,
              operation: `Sinon fake.${operation}`,
            },);
        }
        /** Mark restoration only after success so failed cleanup remains reportable. */
        const result: unknown = Reflect.apply(original, receiver, args,);
        if (operation === 'restore')
          generation.restored = true;
        return result;
      },
    }
      ),
    );
  }
}

/**
 Protects mock controllers whose `expects` method installs the actual object proxy later.

 @param value - raw mock controller registered with Sinon's collection
 
 @param target - input object supplied to `ctx.sinon.mock`
 
 @param owner - capability owner
 
 @returns guarded controller, or the unmodified result for standalone expectations
 
 @example
 ```ts
 return guardMockController({ value, target, owner });
 ```
 */
export function guardMockController({
  value,
  target,
  owner,
}: {
  readonly value: unknown;
  readonly target: unknown;
  readonly owner: SandboxOwner;
},): unknown {
  if ((!isSandboxTarget(value,)) || (!isSandboxTarget(target,)))
    return value;
  return guardSandboxCapability({
    target: value,
    owner,
    operation: 'ctx.sinon.mock()',
    invoke(invocation: SandboxInvocation,): unknown {
      if (invocation.operation === 'ctx.sinon.mock().expects') {
        /**
         Invalid property arguments remain Sinon's own validation responsibility.
         */
        const key = sandboxPropertyKey(invocation.args[0],);
        if (((typeof key) === 'string') || (key !== SINON_VALIDATES_PROPERTY))
          requireUnownedProperty({
            target,
            key,
            operation: invocation.operation,
          },);
      }
      return invokeSandboxMethod(invocation,);
    },
  },);
}

/**
 Replaces injected factory references in place so the original injection destination is guarded too.

 @param value - destination returned by Sinon injection
 
 @param owner - attempt supplying these factories
 
 @param invoke - same operation policy as the main context sandbox
 
 @returns unchanged destination identity with guarded factory properties
 
 @example
 ```ts
 return guardInjectedFactories({ value, owner, invoke });
 ```
 */
export function guardInjectedFactories({
  value,
  owner,
  invoke,
}: {
  readonly value: unknown;
  readonly owner: SandboxOwner;
  readonly invoke: (invocation: SandboxInvocation,) => unknown;
},): unknown {
  if (!isSandboxTarget(value,))
    return value;
  for (const key of Reflect.ownKeys(value,)) {
    /**
     Sinon injection defines plain factory properties.
     */
    const method: unknown = Reflect.get(
      value,
      key,
    );
    if ((typeof method) === 'function') {
      Reflect.set(
        value,
        key,
        guardSandboxCapability({
          target: method,
          owner,
          operation: `ctx.sinon.${String(key,)}`,
          invoke,
        },),
      );
    }
  }
  return value;
}

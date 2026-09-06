/** Read-context selection for supported method properties. @module */
import { SandboxOwnershipError, } from './sandbox-error.ts';
import type { SandboxRuntime, } from './sandbox-owner.ts';
import { methodRegistry, methodSlotConflict, methodSlotIntact, type MethodSlot, } from './sandbox-registry.ts';

/**
 Finds an active slot through an own property, prototype, or copied contextual accessor.

 @param target - object supplied to a Sinon operation
 @param key - exact property being replaced
 @returns active slot, or undefined when ordinary Sinon may handle this property
 @example
 ```ts
 const slot = findMethodSlot({ target, key: 'warn' });
 ```
 */
export function findMethodSlot({ target, key, }: {
  readonly target: object;
  readonly key: PropertyKey;
},): MethodSlot | undefined {
  /** Shared state recognizes getters even when an alias hides target identity. */
  const registry = methodRegistry();
  /** Prototype chains are linear, so traverse with a cursor rather than recursion. */
  let cursor: object | null = target;
  while (cursor !== null) {
    /** Primary lookup also detects deletion or redefinition of an active slot. */
    const direct = registry.targets.get(cursor,)?.get(key,);
    if (direct !== undefined)
      return direct;
    /** Inspect descriptors without executing arbitrary getters. */
    const descriptor = Object.getOwnPropertyDescriptor(cursor, key,);
    if (descriptor !== undefined)
      return descriptor.get === undefined ? undefined : registry.getters.get(descriptor.get,);
    cursor = Object.getPrototypeOf(cursor,) as object | null;
  }
  return undefined;
}

/**
 Prepares, but does not install, a context-selecting descriptor.
 Unsupported targets retain ordinary Sinon behavior unless an active lease owns them.

 @param target - actual consumer object
 @param key - property passed to `stub` or `spy`
 @param runtime - current execution's context capability
 @returns prepared or existing slot for supported methods
 @example
 ```ts
 const slot = prepareMethodSlot({ target, key: 'warn', runtime });
 ```
 */
export function prepareMethodSlot({ target, key, runtime, }: {
  readonly target: object;
  readonly key: PropertyKey;
  readonly runtime: SandboxRuntime;
},): MethodSlot | undefined {
  /** Reuse a slot only through the exact object identity that originally installed it. */
  const existing = findMethodSlot({ target, key, },);
  if (existing !== undefined) {
    if (!runtime.contextual || runtime.isProxy(target,) || existing.target !== target || !methodSlotIntact(existing,))
      throw methodSlotConflict({ slot: existing, operation: 'ctx.sinon.stub/spy', },);
    return existing;
  }
  if (!runtime.contextual || runtime.isProxy(target,))
    return undefined;
  /** Restrict the new contract to configurable own writable data-method properties. */
  const original = Object.getOwnPropertyDescriptor(target, key,);
  if (original?.configurable !== true || original.writable !== true || typeof original.value !== 'function')
    return undefined;
  /** Values are selected from a private facade only while this exact owner is running. */
  const owners: MethodSlot['owners'] = new Map();
  return {
    target, key, original, owners,
    get(): unknown {
      /** Async descendants of completed attempts must never enter another attempt's fake. */
      const current = runtime.current();
      /** Missing registrations include suites, unrelated tests, and contextless consumers. */
      const replacement = current?.phase === 'running' ? owners.get(current,) : undefined;
      return replacement === undefined ? original.value : Reflect.get(replacement.facade, key,);
    },
    set(): never {
      throw new SandboxOwnershipError(
        `Assignment to context-owned property "${String(key,)}" is not supported while it has active mocks. `
          + 'Configure the returned fake or restore its owning sandbox before assigning the property.',
      );
    },
  };
}

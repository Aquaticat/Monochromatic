/** One test-body attempt owns its context, timeout, and sandbox disposal. @module */
import { withTimeout, } from '@monochromatic-dev/module-async-time/ts';
import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ScopedExpect, } from './expect.ts';
import type { TestContext, } from './it.ts';
import { createOwnedSandbox, } from './sandbox.ts';
import type { SandboxOwner, } from './sandbox-owner.ts';

/**
 Executes one attempt and closes its context before restoring any target state.
 Timeout ends ownership even when the original asynchronous body keeps running.

 @param fn - test callback, unchanged across repeated attempts
 @param expect - assertion counter shared with the runner's verdict checks
 @param timeout - optional deadline for the body
 @param name - test name for timeout and ownership diagnostics
 @param l - test hierarchy logger
 @throws original body or timeout error, with disposal errors retained by `using`
 @example
 ```ts
 await runItAttempt({ fn, expect, name: 'saves', l });
 ```
 */
export async function runItAttempt({ fn, expect, timeout, name, l, }: {
  readonly fn: (ctx: TestContext,) => Promise<void>;
  readonly expect: ScopedExpect;
  readonly timeout?: number;
  readonly name: string;
  readonly l: Logger;
},): Promise<void> {
  /** Fresh identity prevents a previous attempt's retained context from reopening. */
  const owner: SandboxOwner = { name, l, phase: 'running', };
  using sandbox = createOwnedSandbox(owner,);
  /** The callback receives a new context on every invocation. */
  const ctx: TestContext = { expect, sinon: sandbox.sinon, };
  /** Start the actual body before attaching its optional timeout. */
  const promise = fn(ctx,);
  await (timeout === undefined ? promise : withTimeout({ promise, ms: timeout, label: name, },));
}

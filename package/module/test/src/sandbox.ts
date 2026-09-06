/** Test-owned sandbox lifecycle, separate from standalone createSinon configuration. @module */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { createSinon, type DisposableSandbox, } from './sinon.ts';
import { guardSandboxCapability, invokeSandboxMethod, } from './sandbox-guard.ts';
import type { SandboxOwner, } from './sandbox-owner.ts';

/** Context facade plus runner-only lifetime disposal. */
export type OwnedSandbox = Disposable & {
  /** Sinon-compatible context surface; retained methods enforce attempt completion. */
  readonly sinon: DisposableSandbox;
};

/**
 Creates a fresh context capability for one attempt, not for all repeats of a test.

 @param owner - fresh attempt identity whose completion precedes restoration
 @returns guarded sandbox and runner-owned cleanup
 @example
 ```ts
 using sandbox = createOwnedSandbox(owner);
 await body({ sinon: sandbox.sinon, expect });
 ```
 */
export function createOwnedSandbox(owner: SandboxOwner,): OwnedSandbox {
  /** Never expose the raw sandbox as a retained test capability. */
  const raw = createSinon();
  /** Cleanup diagnostics carry the test's existing hierarchy. */
  const l = tagged({ tag: createOwnedSandbox.name, l: owner.l, },);
  l.debug('creating attempt sandbox',);
  return {
    sinon: guardSandboxCapability({ target: raw, owner, operation: 'ctx.sinon', invoke: invokeSandboxMethod, },),
    [Symbol.dispose](): void {
      owner.phase = 'completed';
      l.debug('closing attempt before sandbox restoration',);
      raw.restore();
    },
  };
}

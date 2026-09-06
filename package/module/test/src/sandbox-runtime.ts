/** Lazy runtime adapter keeps Node built-ins outside neutral module imports. @module */
import type { SandboxRuntime, } from './sandbox-owner.ts';

/**
 Resolves context support using the same runtime gate as descriptor observation.
 Non-Node execution preserves ordinary Sinon behavior rather than claiming isolation.

 @returns runtime appropriate for the current descriptor execution environment
 @example
 ```ts
 const runtime = await sandboxRuntime();
 ```
 */
export async function sandboxRuntime(): Promise<SandboxRuntime> {
  if (typeof process !== 'undefined' && typeof process.versions?.node === 'string') {
    /** Lazy load is essential for the browser artifact's import boundary. */
    const { nodeSandboxRuntime, } = await import('./execution-node.ts');
    return nodeSandboxRuntime();
  }
  return {
    contextual: false,
    current: () => undefined,
    isProxy: () => false,
    run: ({ body, }) => body(),
  };
}

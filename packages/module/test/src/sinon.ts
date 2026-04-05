import sinon from 'sinon';
import type { SinonSandbox, SinonSandboxConfig, } from 'sinon';

/**
 * Sinon sandbox extended with `Symbol.dispose` and `Symbol.asyncDispose`
 * for use with `await using` / `using` syntax.
 */
export type DisposableSandbox = SinonSandbox & {
  [Symbol.asyncDispose]: () => Promise<void>;
  [Symbol.dispose]: () => void;
};

/**
 * Creates a sinon sandbox that auto-restores on scope exit
 * when used with `await using` or `using`.
 *
 * @param config - Optional sinon sandbox configuration
 *
 * @returns sandbox with dispose symbols attached
 *
 * @example
 * ```ts
 * await using sandbox = createSinon();
 * sandbox.stub(console, 'log').returns(undefined);
 * // sandbox.restore() called automatically at scope exit
 * ```
 */
export function createSinon(config?: SinonSandboxConfig,): DisposableSandbox {
  const sandbox = sinon.createSandbox(config,) as DisposableSandbox;

  sandbox[Symbol.dispose] = function dispose(): void {
    sandbox.restore();
  };

  sandbox[Symbol.asyncDispose] = async function asyncDispose(): Promise<void> {
    sandbox.restore();
  };

  return sandbox;
}

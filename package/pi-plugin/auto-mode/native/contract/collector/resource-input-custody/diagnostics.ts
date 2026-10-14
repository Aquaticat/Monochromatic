/**
 Count repeated native freshness snapshots without retaining one sink write per copy.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Snapshot diagnostics retain bounded counts until the next microtask

/**
 Resource-copy diagnostics never retain source text or caller-provided kind strings.
 */
const l = tagged({ tag: 'auto-mode-native-resource-input' });

/**
 Fixed categories bound diagnostic storage independently of the number of freshness checks.
 */
const counts = { context: 0, system: 0, append: 0, unknown: 0 };

/**
 One pending microtask owns each synchronous batch of attempted snapshots.
 */
const state = { pending: false };

/**
 Emit complete attempt counts after synchronous resource validation yields to the host.
 */
function flushResourceInputDiagnostics(): void {
  /**
   The copied counts survive resetting the next batch before logger callbacks run.
   */
  const batch = { ...counts };
  counts.context = 0;
  counts.system = 0;
  counts.append = 0;
  counts.unknown = 0;
  state.pending = false;
  /**
   The flush boundary identifies aggregated diagnostics without changing snapshot validation.
   */
  const rl = tagged({ tag: flushResourceInputDiagnostics.name, l });
  rl.debug(`native resource snapshot attempts: ${JSON.stringify(batch)}`);
}

/**
 Retain every copy attempt in a bounded diagnostic batch, including unsupported kinds.

 @param kind - original resource boundary, classified without retaining caller-provided text

 @example
 ```ts
 recordResourceInputCopy('context');
 ```
 */
export function recordResourceInputCopy(kind: string): void {
  /**
   Invalid input labels share one category while ordinary kinds retain separate counts.
   */
  const category = (kind === 'context') || (kind === 'system') || (kind === 'append') ? kind : 'unknown';
  counts[category]++;
  if (state.pending) return;
  state.pending = true;
  queueMicrotask(flushResourceInputDiagnostics);
}

//endregion Snapshot diagnostics retain bounded counts until the next microtask

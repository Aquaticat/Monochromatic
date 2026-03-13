import { parseArgs } from "node:util";

import { acquireLock, killExisting, getLockServer } from "./infra/lock.ts";
import { forceCleanup } from "./analyze/llama.ts";
import { cycle } from "./cycle.ts";
import { log } from "./log.ts";

export {};

/** Minutes per cycle interval. */
const INTERVAL_MINUTES = 5;

/** Seconds per minute, used to compose time constants. */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second, used to compose time constants. */
const MS_PER_SECOND = 1_000;

/** Interval between capture-analyze-notify cycles. */
const INTERVAL_MS = INTERVAL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Parsed CLI arguments for the hall-monitor daemon. */
const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: { "kill-existing": { type: "boolean", default: false } },
});

/** Whether the daemon loop should continue running. */
let running = true;

/**
 * Gracefully shuts down the daemon by stopping the main loop,
 * closing the lock socket, and force-killing any llama-server processes.
 */
function shutdown(): void {
  log.debug("[hall-monitor] Shutting down...");
  running = false;
  getLockServer().close();
  // oxlint-disable-next-line eslint-plugin-promise/prefer-await-to-then, eslint-plugin-promise/always-return -- shutdown handler cannot be async; then() is fire-and-forget
  void forceCleanup().then(function setExitCode() {
    process.exitCode = 0;
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/**
 * Main daemon entry point.
 * Acquires the lock, runs the first cycle, then loops at the configured interval.
 *
 * @returns when the daemon stops running
 */
// Async IIFE required because `bun build --compile` does not support top-level await.
// oxlint-disable-next-line typescript/no-floating-promises -- top-level entry point
async function main(): Promise<void> {
  if (!(await acquireLock())) {
    if (args["kill-existing"]) {
      await killExisting();
    } else {
      throw new Error(
        "[hall-monitor] Another instance is already running. Use --kill-existing to replace it.",
      );
    }
  }

  log.debug(
    "[hall-monitor] Starting — capturing every 5 minutes, retaining last 10 minutes",
  );
  log.debug(`[hall-monitor] PID ${process.pid}, lock: abstract socket`);

  await cycle();

  // Not needed because we don't allow configuring interval: defense-in-depth — add a floor (e.g. Math.max(INTERVAL_MS, 60_000))
  // so a misconfigured or zero interval cannot cause a tight spin loop.
  // oxlint-disable-next-line eslint/no-unmodified-loop-condition, typescript-eslint/no-unnecessary-condition -- running is mutated by signal handler
  while (running) {
    // oxlint-disable-next-line eslint/no-await-in-loop, eslint-plugin-promise/avoid-new -- sequential timer loop; setTimeout wrapper for delay
    await new Promise(function intervalDelay(resolve) { setTimeout(resolve, INTERVAL_MS); });
    // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition, eslint/no-await-in-loop -- running is mutated by signal handler; sequential loop
    if (running) await cycle();
  }
}

// oxlint-disable-next-line eslint-plugin-unicorn/prefer-top-level-await -- bun build --compile does not support top-level await
void main();

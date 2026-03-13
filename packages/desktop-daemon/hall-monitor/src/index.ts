import { parseArgs } from "util";

import { acquireLock, killExisting, getLockServer } from "./infra/lock.ts";
import { forceCleanup } from "./analyze/llama.ts";
import { cycle } from "./cycle.ts";
import { log } from "./log.ts";

export {};

/** Interval between capture-analyze-notify cycles. */
const INTERVAL_MS = 5 * 60 * 1000;

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
  getLockServer()?.close();
  forceCleanup().then(() => {
    process.exitCode = 0;
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Async IIFE required because `bun build --compile` does not support top-level await.
// oxlint-disable-next-line typescript/no-floating-promises -- top-level entry point
(async () => {
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
  while (running) {
    await new Promise(function intervalDelay(resolve) { setTimeout(resolve, INTERVAL_MS); });
    if (running) await cycle();
  }
})();

import spawn from "nano-spawn";

/**
 * Emits a syslog message via the `logger` CLI utility.
 * Fire-and-forget: the spawn promise is not awaited so logging never blocks
 * the main flow.
 * @param priority - syslog priority level (e.g. "debug", "info", "warning", "err")
 * @param message - log message body
 * @example
 * ```ts
 * emit("info", "capture cycle complete");
 * ```
 */
function emit(priority: string, message: string): void {
  spawn("logger", ["-t", "hall-monitor", "-p", `user.${priority}`, "--", message]).catch(() => {});
}

/**
 * Syslog-backed logger for hall-monitor.
 * All output is tagged with `hall-monitor` and routed through `logger(1)`,
 * viewable via `journalctl -t hall-monitor -f`.
 * @example
 * ```ts
 * log.info("[cycle] capture complete");
 * log.error("[cycle] ffmpeg failed");
 * ```
 */
export const log = {
  /** Log at debug priority. */
  debug: (msg: string): void => emit("debug", msg),
  /** Log at info priority. */
  info: (msg: string): void => emit("info", msg),
  /** Log at warning priority. */
  warn: (msg: string): void => emit("warning", msg),
  /** Log at err priority. */
  error: (msg: string): void => emit("err", msg),
};

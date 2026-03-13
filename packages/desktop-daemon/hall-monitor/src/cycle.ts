import { captureScreenshot, captureWebcam } from "./infra/capture.ts";
import { store, getRecent } from "./analyze/memory.ts";
import { start as startLlama, stop as stopLlama } from "./analyze/llama.ts";
import { analyze, parseVerdict } from "./analyze.ts";
import { sendNotification } from "./infra/notification.ts";
import { isScreenLocked } from "./infra/screenlock.ts";
import { isBlackFrame } from "./infra/blackdetect.ts";
import { log } from "./log.ts";

//region Decision tracking
// Sliding window of last 5 verdicts. A ring buffer would work here, but a
// fixed-length tuple gives compile-time size enforcement and the shift cost
// for 5 elements is negligible.

/** Possible productivity verdict values. */
type Decision = "PRODUCTIVE" | "UNPRODUCTIVE";

/** Fixed-size tuple tracking the 5 most recent verdicts. */
type DecisionWindow = [Decision, Decision, Decision, Decision, Decision];

/** Bytes per kilobyte, used for human-readable size formatting. */
const BYTES_PER_KB = 1_024;


/** Rolling window of recent verdicts, initialized as all productive. */
let decisions: DecisionWindow = [
  "PRODUCTIVE",
  "PRODUCTIVE",
  "PRODUCTIVE",
  "PRODUCTIVE",
  "PRODUCTIVE",
];
//endregion

/**
 * Checks whether a decision is unproductive.
 *
 * @param d - decision to check
 *
 * @returns true when the decision is UNPRODUCTIVE
 */
function isUnproductive(d: Decision): boolean {
  return d === "UNPRODUCTIVE";
}

/**
 * Executes one capture-analyze-notify cycle.
 * Captures a screenshot and webcam frame, feeds them to the local vision LLM,
 * records the verdict, and sends a desktop notification when 5 consecutive
 * cycles are unproductive.
 *
 * Skips the cycle when the screen is locked or the webcam cover is down.
 *
 * @returns when the cycle completes
 *
 * @example
 * ```ts
 * await cycle();
 * ```
 */
export async function cycle(): Promise<void> {
  // Skip the entire cycle when the session is locked — no point capturing
  // a lock screen, and it avoids waking the GPU for inference.
  if (await isScreenLocked()) {
    log.debug("[cycle] Screen is locked — skipping cycle");
    return;
  }

  const ts = Date.now();
  log.debug(`[${new Date(ts).toLocaleTimeString()}] Starting capture cycle...`);

  try {
    const [screenshot, webcam] = await Promise.all([
      captureScreenshot(),
      captureWebcam(),
    ]);

    // If the webcam image is mostly black the privacy cover is probably down;
    // skip analysis so the user isn't penalised while away.
    if (await isBlackFrame(webcam)) {
      log.debug("[cycle] Webcam image is black (cover down?) — skipping cycle");
      return;
    }
    log.debug(
      `[capture] Screenshot: ${(screenshot.length / BYTES_PER_KB).toFixed(0)}KB, Webcam: ${(webcam.length / BYTES_PER_KB).toFixed(0)}KB`,
    );

    store({ timestamp: ts, screenshot, webcam });
    const sets = getRecent();
    log.debug(`[memory] ${sets.length} capture set(s) in buffer`);

    await startLlama();
    const result = await analyze(sets);
    await stopLlama();

    const verdict = parseVerdict(result);
    /* oxlint-disable-next-line no-magic-numbers -- sliding window indices 1..4 */
    decisions = [decisions[1], decisions[2], decisions[3], decisions[4], verdict];
    const streakCount = decisions.filter(function checkUnproductive(d) { return isUnproductive(d); }).length;

    log.info(`[report] ${result}`);
    log.info(`[verdict] ${verdict} (streak: ${streakCount}/5)`);

    if (decisions.every(function checkUnproductive(d) { return isUnproductive(d); })) {
      await sendNotification(result);
      decisions = [
        "PRODUCTIVE",
        "PRODUCTIVE",
        "PRODUCTIVE",
        "PRODUCTIVE",
        "PRODUCTIVE",
      ];
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[error] ${message}`);
    log.error(`[error] ${message}`);
    try {
      await stopLlama();
    } catch {
      // best-effort cleanup of GPU process
    }
  }
}

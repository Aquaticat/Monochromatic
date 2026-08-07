/**
 * Unconditional stop-blocking detector.
 *
 * The hedging, dismissal, and trailing-question detectors all answer "is this
 * response defective?". This one answers a different question: "did the agent
 * stop while work remained?", and it answers it without consulting the response
 * text at all.
 *
 * The distinction matters because every text-conditioned rule can be satisfied
 * by changing the text. A rule keyed on the phrase `Next:` is satisfied by
 * deleting that sentence, which converts an informative stop into a silent one.
 * This detector cannot be satisfied that way because it reads nothing.
 *
 * Termination does not come from Claude Code. An earlier revision of this
 * comment claimed it did, on three disposable sessions that ended after nine,
 * nine, and seventeen dispatches. That looked like a platform ceiling and was
 * not one: a fourth run, whose agent ran one shell command per continuation,
 * reached thirty-one dispatches and stopped only because the probe's own cap
 * fired. The chain is unbounded exactly when the agent stays busy, which is the
 * case that costs the most. Bounding lives in `continuation-depth.ts`. See
 * `doc/troubleshooting/claude-code-opus-5-premature-turn-end.md`.
 *
 * @module
 */

/**
 * Kill switch. Set to any value in {@link DISABLING_VALUES} to stop forcing
 * continuation without editing settings or code.
 */
const AUTO_CONTINUE_ENV = 'MONOCHROMATIC_STOP_AUTO_CONTINUE' as const;

/**
 * Setting value standing for an unset kill switch.
 *
 * The empty string is the read-side spelling of absence for environment
 * variables, so it is the domain's own "not configured" value rather than a
 * stand-in for one.
 */
const UNSET_SETTING = '' as const;

/**
 * Values that disable forcing continuation.
 *
 * An unset variable means enabled, so the guard is opt-out. An unset
 * environment is the common case and must keep the behavior the user asked for.
 */
const DISABLING_VALUES: ReadonlySet<string> = new Set([
  '0',
  'off',
  'false',
  'no',
],);

/**
 * Reports whether forced continuation is active, given one already-read setting.
 *
 * Pure, so tests exercise every branch without touching process state.
 *
 * @param rawSetting - value read from {@link AUTO_CONTINUE_ENV}, or {@link UNSET_SETTING}
 *
 * @returns `false` only when `rawSetting` names one of {@link DISABLING_VALUES}
 *
 * @example
 * ```ts
 * autoContinueEnabled('off'); // false
 * autoContinueEnabled(''); // true
 * ```
 */
function autoContinueEnabled(rawSetting: string,): boolean {
  return !DISABLING_VALUES.has(
    rawSetting
      .trim()
      .toLowerCase(),
  );
}

/**
 * Reads the kill switch from this process and reports whether blocking applies.
 *
 * Separated from {@link autoContinueEnabled} so the decision stays pure and only
 * this wrapper touches the environment.
 *
 * @returns `false` only when the environment disables forced continuation
 *
 * @example
 * ```ts
 * if (autoContinueActive()) reasons.push(...autoContinueReason());
 * ```
 */
function autoContinueActive(): boolean {
  return autoContinueEnabled(process.env[AUTO_CONTINUE_ENV] ?? UNSET_SETTING,);
}

/**
 * Reminder lines emitted when a stop is refused.
 *
 * Phrased as "you stopped while work remained" rather than "you used a
 * forbidden phrase", because naming a phrase teaches suppression of the phrase.
 * The instruction to keep status prose exists for the same reason: the failure
 * this guard targets is announcing work instead of doing it, and a silent stop
 * is strictly worse than an announced one.
 *
 * The `AskUserQuestion` route matters because it is the only exit that actually
 * gets the agent what a stop was reaching for. That tool waits for the user's
 * answer, so an agent genuinely blocked on a decision can pause without ending
 * its turn, and the hook has nothing to refuse. Stopping, by contrast, ends the
 * work and waits to be restarted by hand, which is the cost this whole
 * mechanism exists to remove.
 *
 * @returns reminder lines, joined by callers into one block reason
 *
 * @example
 * ```ts
 * autoContinueReason().join(' ');
 * ```
 */
function autoContinueReason(): readonly string[] {
  return [
    'You are stopping while tracked work may remain.',
    'Resume the next item now rather than reporting that you will resume it.',
    'If your response named a next action, perform that action in this turn.',
    'Keep writing status and next-step prose exactly as you would have;',
    'do not delete, shorten, or rephrase it to avoid this check,',
    'because a silent stop is worse than an announced one.',
    'If nothing can proceed without a decision from the user,',
    'ask them with the AskUserQuestion tool instead of stopping.',
    'That tool waits for their answer, which is what you actually need;',
    'a stopped turn only ends your work and waits to be restarted.',
    'If the blocker is an external event rather than a decision,',
    'name the concrete blocker and what will clear it.',
  ];
}

export {
  AUTO_CONTINUE_ENV,
  autoContinueActive,
  autoContinueEnabled,
  autoContinueReason,
  DISABLING_VALUES,
  UNSET_SETTING,
};

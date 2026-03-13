#!/usr/bin/env bun

/**
 * Claude Code Stop hook that detects uncertain language markers in Claude's response
 * and blocks the stop to remind Claude to investigate rather than guess.
 *
 * Scans `last_assistant_message` for hedging phrases like "probably", "maybe",
 * "I think", "I believe", etc. When a match is found and `stop_hook_active` is false,
 * blocks the stop with a reminder to gather evidence before responding.
 *
 * Guards against infinite loops via `stop_hook_active` and applies heuristics
 * to reduce false positives (code blocks, quotations, quoted strings).
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "Stop": [{ "type": "command", "command": "ccsr" }]
 * ```
 *
 * @module
 */

import type {
  StopInput,
  StopOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

import {
  readStdin,
} from '@monochromatic-dev/claude-code-plugins-hook-utils';
import {
  findTrailingQuestion,
  findUncertainty,
  stripNonProseRegions,
} from './uncertainty.ts';

export {}

//region Main

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/**
 * Parsed Stop event.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw) as StopInput;

/**
 * Guard against infinite loops.
 * When `stop_hook_active` is true, Claude is already continuing from a previous stop hook block.
 * Re-blocking would create an endless cycle, so allow the stop unconditionally.
 */
if (event.stop_hook_active) {
  const output: StopOutput = {};
  process.stdout.write(JSON.stringify(output));
} else {
  /** Prose content with code blocks, inline code, blockquotes, and quoted strings stripped out. */
  /** Prose content with code blocks, inline code, blockquotes, and quoted strings stripped out. */
  const prose = stripNonProseRegions(event.last_assistant_message ?? '');

  /** First uncertainty marker found in the prose, if any. */
  const match = findUncertainty(prose);

  /** First trailing question found in the prose, if any. */
  const question = findTrailingQuestion(prose);

  /** Collect all applicable reminders into a single block reason. */
  const reasons: string[] = [];

  if (match !== undefined) {
    reasons.push(
      `Your response contains uncertain language ("${match.phrase}").`,
      'Search for evidence, read the relevant code, or check documentation.',
      'Always research thoroughly before responding.',
      'If you have already investigated and the uncertainty is genuinely warranted,',
      'say so explicitly and continue with your response.',
      'This may be a false positive -- use your judgement.',
    );
  }

  if (question !== undefined) {
    reasons.push(
      `Your response ends with a question to the user ("${question.sentence}").`,
      'Use the AskUserQuestion tool to ask the user instead of ending your response with a question.',
      'The AskUserQuestion tool ensures the user sees and can respond to your question directly.',
      'Rephrase your question as an AskUserQuestion tool call and continue.',
    );
  }

  if (reasons.length > 0) {
    /** Blocking output with concatenated reason from all matched reminders. */
    const output: StopOutput = {
      decision: 'block',
      reason: reasons.join(' '),
    };
    process.stdout.write(JSON.stringify(output));
  } else {
    /** Pass-through output allowing the stop to proceed. */
    const output: StopOutput = {};
    process.stdout.write(JSON.stringify(output));
  }
}

//endregion

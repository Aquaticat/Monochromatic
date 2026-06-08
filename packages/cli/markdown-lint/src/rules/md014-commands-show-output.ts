import { isFencedCode, } from '../code.ts';
import {
  diagnose,
  offsetsOf,
  positionOf,
} from '../node-source.ts';
import type {
  Diagnostic,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 * Rule id.
 */
const ID = 'MD014';

/**
 * Shell prompt prefix that marks a command line with no shown output.
 */
const PROMPT = '$ ';

/**
 * Whether every non-empty line of a code block opens with the shell prompt,
 * meaning commands are shown with prompts but no output is interleaved.
 *
 * @param value - code block content
 *
 * @returns whether all non-empty lines are prompt lines
 */
function allLinesArePrompts(value: string,): boolean {
  /**
   * Non-empty lines of the block.
   */
  const nonEmpty = value
    .split('\n',)
    .filter(function isNonEmpty(line: string,): boolean {
      return line.trim() !== '';
    },);
  if (nonEmpty.length === 0) {
    return false;
  }
  return nonEmpty.every(function isPrompt(line: string,): boolean {
    return line.startsWith(PROMPT,);
  },);
}

/**
 * Code block content with the leading shell prompt stripped from each prompt
 * line.
 *
 * @param value - code block content
 *
 * @returns content with prompts removed
 */
function strippedValue(value: string,): string {
  return value
    .split('\n',)
    .map(function stripPrompt(line: string,): string {
      return line.startsWith(PROMPT,)
        ? line.slice(PROMPT.length,)
        : line;
    },)
    .join('\n',);
}

/**
 * Flag a top-level fenced code block whose every line is a shell prompt with no
 * shown output, and attach a fix stripping the prompts. The edit targets the
 * block's value region, located after the opening fence line, so the fences and
 * language stay intact.
 *
 * @param tree - mdast tree under lint
 *
 * @param source - original source, for the value region offsets
 *
 * @returns one diagnostic per prompt-only fenced block
 */
function checkCommandsShowOutput({
  tree,
  source,
}: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const { node, } of walk(tree,)) {
    if (node.type !== 'code') {
      continue;
    }
    /**
     * Start point of the code node; only column-1 blocks are fixed so the
     * value offsets map straight onto source lines.
     */
    const { start: startPoint, } = positionOf(node,);
    if (startPoint.column !== 1) {
      continue;
    }
    if (!isFencedCode({
      node,
      source,
    },)) {
      continue;
    }
    /**
     * Block content.
     */
    const { value, } = node;
    if (!allLinesArePrompts(value,)) {
      continue;
    }
    /**
     * Code node's start offset (the opening fence).
     */
    const { start: startOffset, } = offsetsOf(node,);
    /**
     * Offset of the block content, just past the opening fence line.
     */
    const valueStart = source.indexOf(
      '\n',
      startOffset,
    ) + 1;
    diagnostics.push(diagnose({
      ruleId: ID,
      message: 'Shell prompts with no shown output; remove the `$ ` prompts.',
      node,
      fix: {
        start: valueStart,
        end: valueStart + value.length,
        insertText: strippedValue(value,),
      },
    },),);
  }
  return diagnostics;
}

/**
 * MD014 commands-show-output: a shell block of only `$ ` prompts shows no
 * output. Fixable: strips the prompts.
 */
export const commandsShowOutput: Rule = {
  id: ID,
  fixable: true,
  check: checkCommandsShowOutput,
};

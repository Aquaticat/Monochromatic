/**
 * Pure work-item builders for `unbash` command-info traversal.
 *
 * @module
 */

import type {
  AssignmentPrefix as UnbashAssignmentPrefix,
  Case as UnbashCase,
  Command as UnbashCommand,
  Node as UnbashNode,
  Redirect as UnbashRedirect,
  Statement as UnbashStatement,
  Word as UnbashWord,
} from 'unbash';
import {
  EMPTY_REDIRECTS,
  type WorkItem,
} from './unbash-command-info-types.ts';

/**
 * Build one node work item.
 *
 * @param node - node to enqueue
 *
 * @returns node work item with no inherited redirects
 *
 * @example
 * ```typescript
 * nodeWorkItem(node);
 * ```
 */
function nodeWorkItem(
  node: UnbashNode,
): WorkItem {
  return {
    kind: 'node',
    node,
    redirects: EMPTY_REDIRECTS,
  };
}

/**
 * Build node work items in source order.
 *
 * @param nodes - nodes to enqueue
 *
 * @returns work items in source order
 *
 * @example
 * ```typescript
 * nodeWorkItems(pipeline.commands);
 * ```
 */
function nodeWorkItems(
  nodes: readonly UnbashNode[],
): WorkItem[] {
  return nodes.map(function nodeToWorkItem(node,) {
    return nodeWorkItem(node,);
  },);
}

/**
 * Build statement work items in source order.
 *
 * @param statements - statements to enqueue
 *
 * @returns work items in source order
 *
 * @example
 * ```typescript
 * statementWorkItems(script.commands);
 * ```
 */
function statementWorkItems(
  statements: readonly UnbashStatement[],
): WorkItem[] {
  return statements.map(function statementToWorkItem(statement,) {
    return nodeWorkItem(statement,);
  },);
}

/**
 * Build one word work item.
 *
 * @param word - word to enqueue
 *
 * @returns singleton work item list
 *
 * @example
 * ```typescript
 * wordWorkItems(word);
 * ```
 */
function wordWorkItems(
  word: UnbashWord,
): WorkItem[] {
  return [{
    kind: 'word',
    word,
  },];
}

/**
 * Build word work items in source order.
 *
 * @param words - words to enqueue
 *
 * @returns work items in source order
 *
 * @example
 * ```typescript
 * wordsWorkItems(command.suffix);
 * ```
 */
function wordsWorkItems(
  words: readonly UnbashWord[],
): WorkItem[] {
  return words.flatMap(function wordToWorkItems(word,) {
    return wordWorkItems(word,);
  },);
}

/**
 * Build redirect-only work item.
 *
 * @param redirects - redirects to surface after child commands
 *
 * @returns singleton redirect item when redirects exist
 *
 * @example
 * ```typescript
 * redirectWorkItems(redirects);
 * ```
 */
function redirectWorkItems(
  redirects: readonly UnbashRedirect[],
): WorkItem[] {
  if (redirects.length === 0)
    return [];
  return [{
    kind: 'redirects',
    redirects,
  },];
}

/**
 * Build work items for words attached to redirects.
 *
 * @param redirects - redirects whose target and body words should be scanned
 *
 * @returns word work items in source order
 *
 * @example
 * ```typescript
 * redirectWordItems(redirects);
 * ```
 */
function redirectWordItems(
  redirects: readonly UnbashRedirect[],
): WorkItem[] {
  return redirects.flatMap(function redirectWords(redirect,) {
    return [
      ...(redirect.target === undefined ? [] : wordWorkItems(redirect.target,)),
      ...(redirect.body === undefined ? [] : wordWorkItems(redirect.body,)),
    ];
  },);
}

/**
 * Build work items for words attached to a command.
 *
 * @param command - command whose words should be scanned
 *
 * @param redirects - inherited redirects to scan with command redirects
 *
 * @returns word work items in source order
 *
 * @example
 * ```typescript
 * commandWordItems({ command, redirects: [] });
 * ```
 */
function commandWordItems(
  {
    command,
    redirects,
  }: {
    readonly command: UnbashCommand;
    readonly redirects: readonly UnbashRedirect[];
  },
): WorkItem[] {
  return [
    ...assignmentWordItems(command.prefix,),
    ...(command.name === undefined ? [] : wordWorkItems(command.name,)),
    ...wordsWorkItems(command.suffix,),
    ...redirectWordItems([
      ...command.redirects,
      ...redirects,
    ],),
  ];
}

/**
 * Build assignment value word items.
 *
 * @param assignments - assignment prefixes to scan
 *
 * @returns word work items in source order
 *
 * @example
 * ```typescript
 * assignmentWordItems(command.prefix);
 * ```
 */
function assignmentWordItems(
  assignments: readonly UnbashAssignmentPrefix[],
): WorkItem[] {
  return assignments.flatMap(function assignmentWords(assignment,) {
    return [
      ...wordsWorkItems(assignment.array ?? [],),
      ...(assignment.value === undefined ? [] : wordWorkItems(assignment.value,)),
    ];
  },);
}

/**
 * Build words and body commands from a case statement.
 *
 * @param node - case node to scan
 *
 * @returns work items in source order
 *
 * @example
 * ```typescript
 * caseItemWorkItems(node);
 * ```
 */
function caseItemWorkItems(
  node: UnbashCase,
): WorkItem[] {
  return node.items
    .flatMap(function caseItemWords(item,) {
    return [
      ...wordsWorkItems(item.pattern,),
      nodeWorkItem(item.body,),
    ];
  },);
}


export {
  caseItemWorkItems,
  commandWordItems,
  nodeWorkItem,
  nodeWorkItems,
  redirectWordItems,
  redirectWorkItems,
  statementWorkItems,
  wordWorkItems,
  wordsWorkItems,
};

/**
 * Work-item builders for `unbash` analyzer traversal.
 *
 * @module
 */

import type {
  AssignmentPrefix as UnbashAssignmentPrefix,
  Case as UnbashCase,
  Command as UnbashCommand,
  Node as UnbashNode,
  ParameterExpansionPart as UnbashParameterExpansionPart,
  Redirect as UnbashRedirect,
  Statement as UnbashStatement,
  Word as UnbashWord,
} from 'unbash';
import type { ShellCommandContext, } from './types.ts';
import {
  EMPTY_REDIRECTS,
  type WorkItem,
} from './internal-types.ts';

/**
 * Build one node work item.
 *
 * @param params - node and execution context
 *
 * @returns node work item with no inherited redirects
 *
 * @example
 * ```ts
 * nodeWorkItem({ node, context });
 * ```
 */
function nodeWorkItem(
  {
    node,
    context,
  }: {
    readonly node: UnbashNode;
    readonly context: ShellCommandContext;
  },
): WorkItem {
  return {
    kind: 'node',
    node,
    redirects: EMPTY_REDIRECTS,
    context,
  };
}

/**
 * Build node work items in source order.
 *
 * @param params - nodes and execution context
 *
 * @returns work items in source order
 *
 * @example
 * ```ts
 * nodeWorkItems({ nodes: pipeline.commands, context });
 * ```
 */
function nodeWorkItems(
  {
    nodes,
    context,
  }: {
    readonly nodes: readonly UnbashNode[];
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return nodes.map(function nodeToWorkItem(node,): WorkItem {
    return nodeWorkItem({
      node,
      context,
    },);
  },);
}

/**
 * Build statement work items in source order.
 *
 * @param params - statements and execution context
 *
 * @returns work items in source order
 *
 * @example
 * ```ts
 * statementWorkItems({ statements: script.commands, context });
 * ```
 */
function statementWorkItems(
  {
    statements,
    context,
  }: {
    readonly statements: readonly UnbashStatement[];
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return statements.map(function statementToWorkItem(statement,): WorkItem {
    return nodeWorkItem({
      node: statement,
      context,
    },);
  },);
}

/**
 * Build one word work item.
 *
 * @param params - word and execution context
 *
 * @returns singleton word work item list
 *
 * @example
 * ```ts
 * wordWorkItems({ word, context });
 * ```
 */
function wordWorkItems(
  {
    word,
    context,
  }: {
    readonly word: UnbashWord;
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return [{
    kind: 'word',
    word,
    context,
  },];
}

/**
 * Build word work items in source order.
 *
 * @param params - words and execution context
 *
 * @returns work items in source order
 *
 * @example
 * ```ts
 * wordsWorkItems({ words: command.suffix, context });
 * ```
 */
function wordsWorkItems(
  {
    words,
    context,
  }: {
    readonly words: readonly UnbashWord[];
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return words.flatMap(function wordToWorkItems(word,): WorkItem[] {
    return wordWorkItems({
      word,
      context,
    },);
  },);
}

/**
 * Build nested word items from parameter expansion.
 *
 * @param params - parameter expansion and execution context
 *
 * @returns word work items in source order
 *
 * @example
 * ```ts
 * parameterWordItems({ part, context });
 * ```
 */
function parameterWordItems(
  {
    part,
    context,
  }: {
    readonly part: UnbashParameterExpansionPart;
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return [
    ...(part.operand === undefined
      ? []
      : wordWorkItems({
        word: part.operand,
        context,
      })),
    ...(part.slice === undefined
      ? []
      : [
        ...wordWorkItems({
          word: part.slice.offset,
          context,
        },),
        ...(part.slice.length === undefined
          ? []
          : wordWorkItems({
            word: part.slice.length,
            context,
          })),
      ]),
    ...(part.replace === undefined
      ? []
      : [
        ...wordWorkItems({
          word: part.replace.pattern,
          context,
        },),
        ...wordWorkItems({
          word: part.replace.replacement,
          context,
        },),
      ]),
  ];
}

/**
 * Build assignment value word items.
 *
 * @param params - assignments and execution context
 *
 * @returns word work items in source order
 *
 * @example
 * ```ts
 * assignmentWordItems({ assignments: command.prefix, context });
 * ```
 */
function assignmentWordItems(
  {
    assignments,
    context,
  }: {
    readonly assignments: readonly UnbashAssignmentPrefix[];
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return assignments.flatMap(function assignmentWords(assignment,): WorkItem[] {
    return [
      ...wordsWorkItems({
        words: assignment.array ?? [],
        context,
      },),
      ...(assignment.value === undefined
        ? []
        : wordWorkItems({
          word: assignment.value,
          context,
        })),
    ];
  },);
}

/**
 * Build work items for words attached to redirects.
 *
 * @param params - redirects and execution context
 *
 * @returns word work items in source order
 *
 * @example
 * ```ts
 * redirectWordItems({ redirects, context });
 * ```
 */
function redirectWordItems(
  {
    redirects,
    context,
  }: {
    readonly redirects: readonly UnbashRedirect[];
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return redirects.flatMap(function redirectWords(redirect,): WorkItem[] {
    return [
      ...(redirect.target === undefined
        ? []
        : wordWorkItems({
          word: redirect.target,
          context,
        })),
      ...(redirect.body === undefined
        ? []
        : wordWorkItems({
          word: redirect.body,
          context,
        })),
    ];
  },);
}

/**
 * Build redirect-only work item.
 *
 * @param params - redirects and execution context
 *
 * @returns singleton redirect item when redirects exist
 *
 * @example
 * ```ts
 * redirectWorkItems({ redirects, context });
 * ```
 */
function redirectWorkItems(
  {
    redirects,
    context,
  }: {
    readonly redirects: readonly UnbashRedirect[];
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  if (redirects.length === 0)
    return [];
  return [{
    kind: 'redirects',
    redirects,
    context,
  },];
}

/**
 * Build work items for words attached to command.
 *
 * @param params - command, inherited redirects, and execution context
 *
 * @returns word work items in source order
 *
 * @example
 * ```ts
 * commandWordItems({ command, redirects: [], context });
 * ```
 */
function commandWordItems(
  {
    command,
    redirects,
    context,
  }: {
    readonly command: UnbashCommand;
    readonly redirects: readonly UnbashRedirect[];
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return [
    ...assignmentWordItems({
      assignments: command.prefix,
      context,
    },),
    ...(command.name === undefined
      ? []
      : wordWorkItems({
        word: command.name,
        context,
      })),
    ...wordsWorkItems({
      words: command.suffix,
      context,
    },),
    ...redirectWordItems({
      redirects: [
        ...command.redirects,
        ...redirects,
      ],
      context,
    },),
  ];
}

/**
 * Build words and body commands from case statement.
 *
 * @param params - case node and execution context
 *
 * @returns work items in source order
 *
 * @example
 * ```ts
 * caseItemWorkItems({ node, context });
 * ```
 */
function caseItemWorkItems(
  {
    node,
    context,
  }: {
    readonly node: UnbashCase;
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return node.items
    .flatMap(function caseItemWords(item,): WorkItem[] {
      return [
        ...wordsWorkItems({
          words: item.pattern,
          context,
        },),
        nodeWorkItem({
          node: item.body,
          context,
        },),
      ];
    },);
}

export {
  caseItemWorkItems,
  commandWordItems,
  nodeWorkItem,
  nodeWorkItems,
  parameterWordItems,
  redirectWordItems,
  redirectWorkItems,
  statementWorkItems,
  wordWorkItems,
  wordsWorkItems,
};

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
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { ShellCommandContext, } from './types.ts';
import {
  EMPTY_REDIRECTS,
  type WorkItem,
} from './internal-types.ts';

/**
 * Build one node work item.
 *
 * @param node - node to enqueue
 *
 * @param context - execution context inherited by node
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
    readonly node: ForeignBorrowed<UnbashNode>;
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
 * @param nodes - nodes to enqueue
 *
 * @param context - execution context inherited by nodes
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
    readonly nodes: readonly ForeignBorrowed<UnbashNode>[];
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
 * @param statements - statements to enqueue
 *
 * @param context - execution context inherited by statements
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
    readonly statements: readonly ForeignBorrowed<UnbashStatement>[];
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
 * @param word - word to enqueue
 *
 * @param context - execution context inherited by word
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
    readonly word: ForeignBorrowed<UnbashWord>;
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
 * @param words - words to enqueue
 *
 * @param context - execution context inherited by words
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
    readonly words: readonly ForeignBorrowed<UnbashWord>[];
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
 * @param part - parameter expansion part
 *
 * @param context - execution context inherited by nested words
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
    readonly part: ForeignBorrowed<UnbashParameterExpansionPart>;
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
          word: part.slice
            .offset,
          context,
        },),
        ...(part.slice
          .length
          === undefined
          ? []
          : wordWorkItems({
            word: part.slice
              .length,
            context,
          })),
      ]),
    ...(part.replace === undefined
      ? []
      : [
        ...wordWorkItems({
          word: part.replace
            .pattern,
          context,
        },),
        ...wordWorkItems({
          word: part.replace
            .replacement,
          context,
        },),
      ]),
  ];
}

/**
 * Build assignment value word items.
 *
 * @param assignments - assignment prefixes to scan
 *
 * @param context - execution context inherited by assignment words
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
    readonly assignments: readonly ForeignBorrowed<UnbashAssignmentPrefix>[];
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
 * @param redirects - redirects whose words should be scanned
 *
 * @param context - execution context inherited by redirect words
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
    readonly redirects: readonly ForeignBorrowed<UnbashRedirect>[];
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
 * @param redirects - redirects to surface after child commands
 *
 * @param context - execution context inherited by redirect item
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
    readonly redirects: readonly ForeignBorrowed<UnbashRedirect>[];
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
 * @param command - command whose words should be scanned
 *
 * @param redirects - inherited redirects to scan with command redirects
 *
 * @param context - execution context inherited by command words
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
    readonly command: ForeignBorrowed<UnbashCommand>;
    readonly redirects: readonly ForeignBorrowed<UnbashRedirect>[];
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
 * @param node - case node to scan
 *
 * @param context - execution context inherited by case items
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
    readonly node: ForeignBorrowed<UnbashCase>;
    readonly context: ShellCommandContext;
  },
): WorkItem[] {
  return node.items
    .flatMap(function caseItemWords(
      item: ForeignBorrowed<UnbashCase['items'][number]>,
    ): WorkItem[] {
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

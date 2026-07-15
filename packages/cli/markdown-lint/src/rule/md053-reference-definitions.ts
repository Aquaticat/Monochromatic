import type { ReadonlyDeep, } from 'type-fest';
import {
  diagnose,
  offsetsOf,
} from '../node-source.ts';
import type {
  Diagnostic,
  Fix,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';
import type { Definition, } from 'mdast';

/**
 * Rule id.
 */
const ID = 'MD053';

/**
 * Definition labels never reported, matching markdownlint's default
 * `ignored_definitions: ["//"]` (the `[//]: # (comment)` trick).
 */
const IGNORED_DEFINITIONS: ReadonlySet<string> = new Set(['//',],);

/**
 * Parameters for {@link removalFix}.
 */
type RemovalFixParams = {
  /**
   * Definition to remove.
   */
  readonly definition: Definition;
  /**
   * Original source.
   */
  readonly source: string;
};

/**
 * A fix that deletes a definition's line, including its trailing newline when
 * present so no blank line is left where the definition stood.
 *
 * @param definition - definition to remove
 *
 * @param source - original source
 *
 * @returns deletion fix for the definition line
 */
function removalFix({
  definition,
  source,
}: ReadonlyDeep<RemovalFixParams>,): Fix {
  /**
   * Definition's source offsets.
   */
  const {
    start,
    end,
  } = offsetsOf(definition,);
  /**
   * End of the deletion, extended past a trailing newline when there is one.
   */
  const deleteEnd = source[end] === '\n'
    ? end + 1
    : end;
  return {
    start,
    end: deleteEnd,
    insertText: '',
  };
}

/**
 * Flag link/image reference definitions that are unused (no reference resolves
 * to them) or duplicated (a later definition of an already-kept label), and
 * attach a fix removing each. Used definitions are exactly those a
 * `linkReference`/`imageReference` resolves to, since mdast only creates those
 * nodes when a definition exists. Two passes: collect uses and definitions,
 * then judge each definition.
 *
 * @param tree - mdast tree under lint
 *
 * @param source - original source, for the removal offsets
 *
 * @returns one diagnostic per unused or duplicate definition
 */
function checkReferenceDefinitions({
  tree,
  source,
}: RuleContext,): readonly Diagnostic[] {
  /**
   * Identifiers that a reference resolves to.
   */
  const usedIds = new Set<string>();
  /**
   * Every definition, in document order.
   */
  const definitions: Definition[] = [];
  for (const { node, } of walk(tree,)) {
    if ((node.type === 'linkReference') || (node.type === 'imageReference')) {
      usedIds.add(node.identifier,);
      continue;
    }
    if (node.type === 'definition') {
      definitions.push(node,);
    }
  }
  /**
   * Identifiers whose first used definition has been kept.
   */
  const keptIds = new Set<string>();
  /**
   * Diagnostics collected across the definitions.
   */
  const diagnostics: Diagnostic[] = [];
  for (const definition of definitions) {
    if (IGNORED_DEFINITIONS.has(definition.identifier,)) {
      continue;
    }
    if (!usedIds.has(definition.identifier,)) {
      diagnostics.push(diagnose({
        ruleId: ID,
        message: `Unused reference definition "${definition.identifier}".`,
        node: definition,
        fix: removalFix({
          definition,
          source,
        },),
      },),);
      continue;
    }
    if (keptIds.has(definition.identifier,)) {
      diagnostics.push(diagnose({
        ruleId: ID,
        message: `Duplicate reference definition "${definition.identifier}".`,
        node: definition,
        fix: removalFix({
          definition,
          source,
        },),
      },),);
      continue;
    }
    keptIds.add(definition.identifier,);
  }
  return diagnostics;
}

/**
 * MD053 link-image-reference-definitions: every reference definition must be
 * used and unique. Fixable: removes unused and duplicate definitions.
 */
export const referenceDefinitions: Rule = {
  id: ID,
  fixable: true,
  check: checkReferenceDefinitions,
};

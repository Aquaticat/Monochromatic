/**
 Separate contextual headings from standalone retained heading candidates. @module
 */
import type { PolicyHeading } from '../../policy-index-types.ts';
import type {
  GoverningBindingIndex,
  GoverningClauseRetention,
  RetainedUnclassifiedClause,
} from './binding-types.ts';

/**
 Preserve original heading ancestry while retaining every unreferenced heading as an unclassified subject.

 @param index - original source headings in parser order

 @param referenced - exact headings used as context by original indexed intervals

 @param retain - original source owner creates canonical candidate handles

 @param unclassified - original owner's retained unclassified diagnostics

 @returns frozen contextual heading projections without instruction qualification

 @example retainGoverningHeadings({ index, referenced, retain, unclassified });
 */
export function retainGoverningHeadings({
  index,
  referenced,
  retain,
  unclassified
}: Readonly<{
  index: GoverningBindingIndex;
  referenced: ReadonlySet<PolicyHeading>;
  retain: (input: GoverningClauseRetention) => Readonly<object>;
  unclassified: RetainedUnclassifiedClause[];
}>): readonly PolicyHeading[] {
  /**
   Current ancestry follows original parser depth rather than equal heading text.
   */
  const state: { ancestry: PolicyHeading[] } = { ancestry: [] };
  /**
   Only referenced original headings belong to the aggregate context subject.
   */
  const contextual: PolicyHeading[] = [];
  for (const heading of index.headings ?? []) {
    state.ancestry = state.ancestry
      .filter(function hasShallowerHeadingDepth(parent) { return parent.depth < heading.depth; });
    if (referenced.has(heading)) {
      contextual.push(Object.freeze({
        start: heading.start,
        end: heading.end,
        text: heading.text,
        depth: heading.depth
      }));
    } else {
      /**
       An orphan heading retains its original parents, not itself, as contextual text.
       */
      const candidate = retain({
        record: {
          ...heading,
          headings: state.ancestry
        },
        classification: {
          kind: 'unclassified-source-span',
          nodeType: 'heading'
        },
      });
      unclassified.push(Object.freeze({
        candidate,
        start: heading.start,
        end: heading.end,
        text: heading.text,
        type: 'heading'
      }));
    }
    state.ancestry = [
      ...state.ancestry,
      heading
    ];
  }
  return Object.freeze(contextual);
}

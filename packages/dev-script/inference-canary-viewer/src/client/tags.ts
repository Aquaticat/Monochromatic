/**
 * Lezer tag-to-highlight-group mapping for the CSS Custom Highlight API.
 *
 * Defines which Lezer parse tree tags map to which named highlight groups.
 * Each group name corresponds to a `::highlight(hl-<group>)` CSS pseudo-element
 * and a `--hl-<group>` CSS custom property for its color.
 *
 * Mirrors the mapping used by ssg-test and editord for visual consistency.
 */

import {
  type Highlighter,
  tagHighlighter,
  tags,
} from '@lezer/highlight';

/**
 * Named highlight groups used with the CSS Custom Highlight API.
 * Each group gets a `::highlight(hl-<name>)` CSS rule and a `--hl-<name>` color variable.
 */
export const HIGHLIGHT_GROUPS = [
  'keyword',
  'string',
  'comment',
  'number',
  'type',
  'function',
  'property',
] as const;

/**
 * Union type of all highlight group names.
 */
export type HighlightGroup = typeof HIGHLIGHT_GROUPS[number];

/**
 * Lezer highlighter that maps parse tree tags to highlight group names.
 * Used with `highlightTree` to collect token ranges for CSS Custom Highlight registration.
 *
 * Focused on TypeScript/JavaScript tokens since the viewer only highlights
 * canary source code.
 */
export const viewerHighlighter: Highlighter = tagHighlighter([
  {
    tag: [
      tags.function(tags.variableName,),
      tags.function(tags.propertyName,),
    ],
    class: 'function',
  },
  {
    tag: [
      tags.typeName,
      tags.namespace,
    ],
    class: 'type',
  },
  {
    tag: [
      tags.keyword,
      tags.bool,
      tags.null,
      tags.self,
    ],
    class: 'keyword',
  },
  {
    tag: [
      tags.string,
      tags.special(tags.string,),
      tags.regexp,
      tags.escape,
    ],
    class: 'string',
  },
  {
    tag: tags.comment,
    class: 'comment',
  },
  {
    tag: tags.number,
    class: 'number',
  },
  {
    tag: [
      tags.propertyName,
      tags.labelName,
      tags.attributeName,
    ],
    class: 'property',
  },
],);

/**
 * Lezer tag-to-highlight-group mapping for the CSS Custom Highlight API.
 *
 * Defines which Lezer parse tree tags map to which named highlight groups.
 * Each group name corresponds to a `::highlight(hl-<group>)` CSS pseudo-element
 * and a `--hl-<group>` CSS custom property for its color.
 *
 * Mirrors the mapping used by editord for visual consistency across
 * the editor and the published site.
 */

import {
  type Highlighter,
  tagHighlighter,
  tags,
} from '@lezer/highlight';

export {
  HIGHLIGHT_GROUPS,
  type HighlightGroup,
} from './highlight-groups.ts';

/**
 * Lezer highlighter that maps parse tree tags to highlight group names.
 * Used with `highlightTree` to collect token ranges for CSS Custom Highlight registration.
 *
 * Tag specificity is handled by `tagHighlighter` internally; more specific
 * modifier tags (e.g. `function(variableName)`) take priority over base tags.
 * Base tags like `comment` and `number` match their subtypes
 * (`lineComment`, `blockComment`, `integer`, `float`, etc.) via tag hierarchy.
 *
 * Markdown and HTML tags map to groups that reuse color variables:
 * headings get their own color, links get blue, emphasis/strong get gold.
 */
export const ssgHighlighter: Highlighter = tagHighlighter([
  //region Code tags (JS/TS, JSON, CSS, YAML)
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
  //endregion Code tags

  //region Document tags (Markdown, HTML)
  {
    tag: tags.heading,
    class: 'heading',
  },
  {
    tag: [
      tags.link,
      tags.url,
    ],
    class: 'link',
  },
  {
    tag: [
      tags.emphasis,
      tags.strong,
    ],
    class: 'emphasis',
  },
  {
    tag: tags.monospace,
    class: 'string',
  },
  {
    tag: tags.quote,
    class: 'comment',
  },
  {
    tag: tags.contentSeparator,
    class: 'comment',
  },
  {
    tag: [
      tags.tagName,
      tags.angleBracket,
    ],
    class: 'keyword',
  },
  //endregion Document tags
],);

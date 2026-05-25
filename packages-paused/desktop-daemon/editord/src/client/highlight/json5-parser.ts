/**
 * JSON5 parser with highlight style tags.
 *
 * The `lezer-json5` community package ships without `styleTags`,
 * so `highlightTree` produces zero ranges by default.
 * This module patches the parser with tag mappings for the node types
 * defined in its grammar: `LineComment`, `BlockComment`, `Number`,
 * `String`, `PropertyName`, `Null`, `True`, `False`.
 */

import type { Parser, } from '@lezer/common';
import {
  styleTags,
  tags,
} from '@lezer/highlight';
import { parser as json5BaseParser, } from 'lezer-json5';

// oxlint-disable typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-assignment -- community package; runtime type is LRParser with a valid configure method
/**
 * JSON5 parser configured with highlight tags.
 *
 * @see module doc for rationale
 */
export const json5Parser: Parser = json5BaseParser.configure({
  props: [
    styleTags({
      LineComment: tags.lineComment,
      BlockComment: tags.blockComment,
      Number: tags.number,
      String: tags.string,
      PropertyName: tags.propertyName,
      Null: tags.null,
      True: tags.bool,
      False: tags.bool,
    },),
  ],
},);
// oxlint-enable typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-assignment

import type { Root, } from 'mdast';

import {
  type LoneContainerTag,
  maskLoneContainerTags,
} from './mask-container-tags.ts';
import { maskHtmlComments, } from './mask-html-comments.ts';
import { maskInvisibleLines, } from './mask-invisible-lines.ts';
import { parseMdxBody, } from './parse-mdx.ts';
import type { DeepReadonlyData, } from './readonly-data.ts';

/**
 Parses slice syntax with offset-preserving invisible-line, comment and lone-container masks.
 Structural admission and the model-facing break display share this grammar;
 neither treats literals inside expressions or code as prose line breaks.

 @param text - canonical slice bytes whose offsets the tree must retain

 @returns Positioned tree and container tags represented separately by atoms

 @throws {@link import('./parse-mdx.ts').MdxParseError} when strict grammar cannot read the masked slice

 @example
 ```ts
 const { root, tags } = parseSliceBody({ text: sourceText });
 ```
 */
export function parseSliceBody({ text, }: { readonly text: string; },): {
  readonly root: DeepReadonlyData<Root>;
  readonly tags: readonly LoneContainerTag[];
} {
  /**
   A line showing nothing yet not blank to CommonMark becomes spaces first, as
   `parseDocument` does, so the slice has the blocks the page has and no
   paragraph is welded to the next by a line only a reader cannot see.
   */
  const { masked: unwelded, } = maskInvisibleLines({ text, },);
  /**
   Comments become same-length whitespace, so no position moves.
   */
  const { masked: withoutComments, } = maskHtmlComments({ text: unwelded, },);
  /**
   A container half remains an atom without making the body unparseable.
   */
  const {
    masked,
    tags,
  } = maskLoneContainerTags({ text: withoutComments, },);
  return {
    root: parseMdxBody({ body: masked, },),
    tags,
  };
}

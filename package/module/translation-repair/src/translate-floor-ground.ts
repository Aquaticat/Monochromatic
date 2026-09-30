import {
  type FrontMatterBlock,
  requireFrontMatterRefusal,
  splitFrontMatter,
} from './front-matter.ts';
import {
  readSliceSkeleton,
  type SliceSkeleton,
} from './translate-skeleton.ts';
import {
  type PageGrammar,
  readPageSkeleton,
} from './translate-skeleton-page.ts';

//region Floor ground
// What the deterministic source floor stands on for one slice: the original
// and the page the candidate would replace, each read by the grammar the
// slice's syntax calls for.
//
// ONE DEFINITION OF WHETHER THE FLOOR CAN COMPARE ANYTHING. The floor
// (`translate-validate.ts`, `front-matter-translation.ts`) answers `unknown`
// where it cannot, and the translate stage has to ask the same question
// before it buys a round, since on such a slice no candidate can pass (ledger
// B43). Two spellings would eventually disagree, and a slice falling between
// them would be bought and shipped unchecked, or settled without a round the
// floor could have checked.
//
// A SIDE NO GRAMMAR READS IS NOT A CANDIDATE'S FAULT, so no reading here
// throws for one. The front-matter floor read both sides inside the try that
// guards the candidate's YAML, and charged a refusal of the original's or the
// page's YAML to whatever the candidate wrote (ledger B44).

/**
 A side of the comparison no grammar read.

 @example
 ```ts
 const blind: BlindGround = { kind: 'blind', side: 'original', detail: 'original could not be read: ...', };
 ```
 */
export type BlindGround = {
  readonly kind: 'blind';

  /**
   Which side: the original, or the page the candidate would replace. The
   floor still refuses a candidate the strict grammar cannot read before it
   reports a page it cannot, so the side decides where that report falls.
   */
  readonly side: 'original' | 'page';

  /**
   Why, in the words the floor's `unknown` verdict carries.
   */
  readonly detail: string;
};

/**
 Both sides of an ordinary Markdown slice, or the side no grammar read.

 @example
 ```ts
 const ground: MarkdownGround = readMarkdownGround({ sourceText, pageText, },);
 ```
 */
export type MarkdownGround =
  | BlindGround
  | {
    readonly kind: 'read';

    /**
     Shape the original carries, read by the strict grammar.
     */
    readonly source: SliceSkeleton;

    /**
     Shape the page carries, empty only where there is no page.
     */
    readonly page: SliceSkeleton;

    /**
     Grammar that read the page, since a plain-markdown reading is weaker
     evidence than a strict one.
     */
    readonly pageGrammar: PageGrammar;
  };

/**
 Both sides of a front-matter slice, or the side no reader read.

 @example
 ```ts
 const ground: FrontMatterGround = readFrontMatterGround({ sourceText, pageText, },);
 ```
 */
export type FrontMatterGround =
  | BlindGround
  | {
    readonly kind: 'read';

    /**
     Metadata the original declares.
     */
    readonly source: FrontMatterBlock;

    /**
     Metadata the page carries, absent where there is no page.
     */
    readonly page?: FrontMatterBlock;
  };

/**
 Reads both sides of an ordinary Markdown slice as the floor compares them.

 THE ORIGINAL FIRST, and the page only where the original read: an original
 no grammar reads leaves nothing to compare, whatever the page is.

 @param sourceText - original slice

 @param pageText - text a candidate would replace, empty where the slice has
 none

 @returns Both readings, or the side no grammar read and why

 @example
 ```ts
 const ground = readMarkdownGround({ sourceText: '猫猫在窗台上打盹。', pageText: '', },);
 ```
 */
export function readMarkdownGround(
  {
    sourceText,
    pageText,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
  },
): MarkdownGround {
  /**
   Original's reading under the strict grammar.
   */
  const source = readSliceSkeleton({ text: sourceText, },);
  // An original the strict grammar refuses is not a candidate's fault, and
  // there is nothing to compare against. Document parsing has a plain-markdown
  // fallback for exactly this, so a slice can reach here that no skeleton can
  // be read from, and inventing a comparison across two grammars would
  // manufacture findings rather than find any.
  if (source.kind === 'unparseable')
    return {
      kind: 'blind',
      side: 'original',
      detail: `original could not be read: ${source.detail}`,
    };

  /**
   Page's reading, downgraded to plain markdown where the strict grammar
   refuses it (`readPageSkeleton`).
   */
  const {
    read: page,
    grammar: pageGrammar,
  } = readPageSkeleton({ text: pageText, },);
  // A PAGE NEITHER GRAMMAR READS is not the candidate's fault either, and the
  // block floor has nothing to stand on: plain markdown refuses a page only
  // when reading it exhausts the parser, nesting past its stack.
  if (page.kind === 'unparseable')
    return {
      kind: 'blind',
      side: 'page',
      detail: `page could not be read: ${page.detail}`,
    };

  return {
    kind: 'read',
    source: source.skeleton,
    page: page.skeleton,
    pageGrammar,
  };
}

/**
 One side's front matter, or why it could not be read.
 */
type FrontMatterSide =
  | {
    readonly kind: 'read';
    readonly block: FrontMatterBlock;
  }
  | {
    readonly kind: 'unread';
    readonly detail: string;
  };

/**
 Reads one side's front matter, or says why it could not be read.

 @param text - front-matter slice text

 @param name - what a detail calls this side

 @returns The block, or why none could be read

 @throws Whatever the splitter throws that is not a YAML refusal, since that
 is a fault in this code rather than a fact about the text

 @example
 ```ts
 const side = frontMatterSide({ text: sourceText, name: 'source', },);
 ```
 */
function frontMatterSide(
  {
    text,
    name,
  }: {
    readonly text: string;
    readonly name: 'source' | 'page';
  },
): FrontMatterSide {
  try {
    /**
     Block the splitter found, absent where the text opens with no fenced pair.
     */
    const { frontMatter, } = splitFrontMatter({ text, },);
    if (frontMatter === undefined)
      return {
        kind: 'unread',
        detail: `${name} front matter could not be read`,
      };
    return {
      kind: 'read',
      block: frontMatter,
    };
  }
  catch (error) {
    /**
     The YAML refusal, whose message is safe to carry: it names where the
     parser stopped and what it called the fault, and repeats no front
     matter.
     */
    const refusal = requireFrontMatterRefusal({ error, },);
    return {
      kind: 'unread',
      detail: `${name} front matter could not be read: ${refusal.message}`,
    };
  }
}

/**
 Reads both sides of a front-matter slice as the floor compares them.

 @param sourceText - original front matter

 @param pageText - front matter a candidate would replace, empty where the
 page has none

 @returns Both blocks, or the side no reader read and why

 @throws Whatever the splitter throws that is not a YAML refusal

 @example
 ```ts
 const ground = readFrontMatterGround({ sourceText: '---\nname: 猫猫\n---\n', pageText: '', },);
 ```
 */
export function readFrontMatterGround(
  {
    sourceText,
    pageText,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
  },
): FrontMatterGround {
  /**
   Original's metadata, or why it could not be read.
   */
  const source = frontMatterSide({
    text: sourceText,
    name: 'source',
  },);
  if (source.kind === 'unread')
    return {
      kind: 'blind',
      side: 'original',
      detail: source.detail,
    };
  // NO PAGE IS NOT AN UNREAD PAGE: an insertion writes new metadata in the
  // original's shape.
  if (pageText === '')
    return {
      kind: 'read',
      source: source.block,
    };

  /**
   Page's metadata, or why it could not be read.
   */
  const page = frontMatterSide({
    text: pageText,
    name: 'page',
  },);
  if (page.kind === 'unread')
    return {
      kind: 'blind',
      side: 'page',
      detail: page.detail,
    };
  return {
    kind: 'read',
    source: source.block,
    page: page.block,
  };
}

//endregion Floor ground

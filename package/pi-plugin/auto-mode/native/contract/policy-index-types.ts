/**
 Structural policy indexing preserves original text and offsets without assigning authority.
 @module
 */
import type {MdastNode} from 'satteri';

//region Index values retain original UTF-16 source intervals.
/**
 Original source interval, with an exclusive end offset.
 */
export type PolicySourceSpan={
  /**
   Original first UTF-16 offset.
   */
  readonly start:number;
  /**
   Original exclusive UTF-16 end.
   */
  readonly end:number;
  /**
   Exact source text within that interval.
   */
  readonly text:string;
};
/**
 Heading context retains its original depth and source interval.
 */
export type PolicyHeading=PolicySourceSpan&{
  /**
   Native Markdown heading depth.
   */
  readonly depth:number;
};
/**
 Tagged paragraph retains its original heading context.
 */
export type IndexedPolicyRule=PolicySourceSpan&{
  /**
   Literal source handle, without semantic interpretation.
   */
  readonly code:string;
  /**
   Original enclosing heading occurrences.
   */
  readonly headings:readonly PolicyHeading[];
};
/**
 Unclassified content remains present for downstream coverage checks.
 */
export type UnclassifiedPolicyNode=PolicySourceSpan&{
  /**
   Original Markdown node category.
   */
  readonly type:MdastNode['type'];
  /**
   Original enclosing heading occurrences.
   */
  readonly headings:readonly PolicyHeading[];
};
//endregion

//region Structural coverage never establishes source authority or semantic qualification.
/**
 Complete structural index of the original policy text.
 */
export type PolicyIndex={
  /**
   Digest of complete original source bytes.
   */
  readonly sourceSha256:string;
  /**
   UTF-8 byte length of complete original source.
   */
  readonly sourceBytes:number;
  /**
   Every original heading occurrence, including unreferenced headings.
   */
  readonly headings:readonly PolicyHeading[];
  /**
   Original tagged paragraphs.
   */
  readonly records:readonly IndexedPolicyRule[];
  /**
   Retained nodes outside the literal tag profile.
   */
  readonly unclassified:readonly UnclassifiedPolicyNode[];
  /**
   Structural accounting distinguishes retained unclassified nodes.
   */
  readonly structuralCoverage:'all-top-level-nodes-indexed'|'unclassified-nodes-retained';
  /**
   The index makes no semantic qualification claim.
   */
  readonly semanticCoverage:'not-established';
  /**
   Source authority remains outside indexing.
   */
  readonly authorityEstablishedByIndex:false;
};
/**
 Original parser receives complete source with an explicit Markdown-only selection.
 */
export type PolicyIndexInput={
  /**
   Complete original policy text.
   */
  readonly source:string;
  /**
   Incumbent parser result is checked for its root and source spans.
   */
  readonly parse:(input:{
    /**
     Complete original policy text.
     */
    readonly source:string;
    /**
     Explicit Markdown-only profile.
     */
    readonly mdx:boolean;
  })=>MdastNode;
};
//endregion

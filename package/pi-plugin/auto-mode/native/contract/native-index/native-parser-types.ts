/**
 Native policy parsing exposes only the measured Markdown tree and qualification metadata.

 @module
 */
import type { MdastNode } from 'satteri';

//region The native consumer receives a Markdown root with original coordinates

/**
 Root shape comes from the installed parser's declared Markdown node union.
 */
export type NativeMarkdownTree = Extract<MdastNode, { readonly type: 'root' }>;

/**
 Parser result retains the source checks used by the native policy index.
 */
export type NativeMarkdownParser = {
  /**
   Source parsing requires an explicit Markdown-only selection.
   */
  readonly parse: (input: {
    /** Original policy text. */
    readonly source: string;
    /** MDX remains outside the measured parser profile. */
    readonly mdx: boolean;
  }) => NativeMarkdownTree;
  /**
   Metadata identifies the measured JavaScript entry and exact parser options.
   */
  readonly metadata: {
    /** Qualified installed package and version. */
    readonly package: string;
    /** Original resolved JavaScript entry. */
    readonly entry: string;
    /** SHA-256 of original JavaScript entry bytes. */
    readonly entrySha256: string;
    /** SHA-256 of original package manifest bytes. */
    readonly packageSha256: string;
    /** Only the measured Markdown extensions are selected. */
    readonly features: {
      /** Preserve the qualified GitHub-flavored Markdown behavior. */
      readonly gfm: true;
      /** Preserve the qualified frontmatter handling. */
      readonly frontmatter: true;
    };
    /** Coordinates are verified against original JavaScript string offsets. */
    readonly observedCoordinateUnit: 'UTF16-code-units';
    /** No historical code-point conversion is applied. */
    readonly extraCorrectionApplied: false;
    /** Explicit limits remain attached to the measured adapter. */
    readonly scope: string;
  };
};

//endregion The native consumer receives a Markdown root with original coordinates

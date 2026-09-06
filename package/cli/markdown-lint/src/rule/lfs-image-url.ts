import type { ReadonlyDeep, } from 'type-fest';
import type {
  Definition,
  Image,
} from 'mdast';
import {
  dirname,
  posix,
  relative,
  resolve,
  sep,
} from 'node:path';

import type { LfsImageContext, } from '../lfs-image-context.ts';
import {
  objectUrlParts,
  relativeTargetPath,
} from '../lfs-image-target.ts';
import {
  diagnose,
  offsetsOf,
  sliceOf,
} from '../node-source.ts';
import type {
  Diagnostic,
  Fix,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 Rule id.
 */
const ID = 'lfs-image-url';

/**
 A node whose `url` this rule may rewrite: an inline image, or a reference
 definition that at least one image reference resolves to.
 */
type UrlNode = Image | Definition;

/**
 Where a written URL sits inside its node's source.
 */
type UrlSpan = {
  /**
   Absolute source offset where the URL text starts.
   */
  readonly start: number;
  /**
   Absolute source offset just past the URL text.
   */
  readonly end: number;
};

/**
 Parameters for {@link urlSpanOf}.
 */
type UrlSpanOfParams = {
  /**
   Image or definition.
   */
  readonly node: ReadonlyDeep<UrlNode>;
  /**
   Original source.
   */
  readonly source: string;
};

/**
 Locate the written URL inside a node's source: after `](` for an image or
 after `]:` for a definition, either bare or wrapped in angle brackets. Empty
 when the written form differs from `node.url` (an escaped or entity-encoded
 destination), in which case the rule reports without a fix.

 @param node - image or definition

 @param source - original source

 @returns one span, or none
 */
function urlSpanOf({
  node,
  source,
}: UrlSpanOfParams,): readonly UrlSpan[] {
  /**
   Node's source offsets.
   */
  const { start, } = offsetsOf(node,);
  /**
   Node's written form.
   */
  const slice = sliceOf({
    node: node as UrlNode,
    source,
  },);
  /**
   Marker that ends the label: `](` for images, `]:` for definitions.
   */
  const marker = node.type === 'image' ? '](' : ']:';
  /**
   Position of the marker, searched from the end for images because an alt
   text may itself contain `](`.
   */
  const markerAt = node.type === 'image' ? slice.lastIndexOf(marker,) : slice.indexOf(marker,);
  if (markerAt === (-1)) {
    return [];
  }
  /**
   Text after the marker.
   */
  const afterMarker = slice.slice(markerAt + marker.length,);
  /**
   Position of the first non-space character after the marker.
   */
  const urlStart = markerAt + marker.length
    + (afterMarker.length
      - afterMarker.trimStart()
      .length);
  if (slice.startsWith(
    node.url,
    urlStart,
  )) {
    return [{
      start: start + urlStart,
      end: start
        + urlStart
        + node.url
        .length,
    },];
  }
  if (slice.startsWith(
    `<${node.url}>`,
    urlStart,
  )) {
    return [{
      start: start + urlStart
        + 1,
      end: start
        + urlStart
        + 1
        + node.url
        .length,
    },];
  }
  return [];
}

/**
 Parameters for {@link rewriteDiagnostic}.
 */
type RewriteDiagnosticParams = {
  /**
   Node whose URL is reported.
   */
  readonly node: ReadonlyDeep<UrlNode>;
  /**
   Original source.
   */
  readonly source: string;
  /**
   Message describing why the URL changes.
   */
  readonly message: string;
  /**
   Replacement destination.
   */
  readonly replacement: string;
};

/**
 Diagnostic carrying a fix that replaces the written URL, or a report-only
 diagnostic when the written URL cannot be located.

 @param node - node whose URL is reported

 @param source - original source

 @param message - message describing why the URL changes

 @param replacement - replacement destination

 @returns diagnostic anchored at the node
 */
function rewriteDiagnostic({
  node,
  source,
  message,
  replacement,
}: RewriteDiagnosticParams,): Diagnostic {
  /**
   Span of the written URL, when located.
   */
  const [span,] = urlSpanOf({
    node,
    source,
  },);
  /**
   Fix replacing the span, when located.
   */
  const fixes: readonly Fix[] = span === undefined
    ? []
    : [{
      start: span.start,
      end: span.end,
      insertText: replacement,
    },];
  /**
   Located fix, if any.
   */
  const [fix,] = fixes;
  return diagnose({
    ruleId: ID,
    message: fix === undefined ? `${message} (written URL not located; edit by hand)` : message,
    node: node as UrlNode,
    ...fix === undefined ? {} : { fix, },
  },);
}

/**
 Parameters for {@link checkRelativeUrl} and {@link checkObjectUrl}.
 */
type CheckUrlParams = {
  /**
   Node whose URL is checked.
   */
  readonly node: ReadonlyDeep<UrlNode>;
  /**
   Original source.
   */
  readonly source: string;
  /**
   Per-file LFS context.
   */
  readonly lfs: LfsImageContext;
};

/**
 Parameters for {@link objectUrl}.
 */
type ObjectUrlParams = {
  /**
   Per-file LFS context.
   */
  readonly lfs: LfsImageContext;
  /**
   Object id.
   */
  readonly oid: string;
  /**
   Forward-slash path from the repository root.
   */
  readonly repoRelativePath: string;
};

/**
 Object URL for a repo-relative path and its oid.

 @param lfs - per-file LFS context

 @param oid - object id

 @param repoRelativePath - forward-slash path from the repository root

 @returns `<objectBase>/<oid>/<path>`
 */
function objectUrl({
  lfs,
  oid,
  repoRelativePath,
}: ObjectUrlParams,): string {
  return `${lfs.objectBase}/${oid}/${repoRelativePath}`;
}

/**
 Check a relative destination: an LFS-tracked target gets an object URL,
 anything else is left to other rules.

 @param node - node whose URL is checked

 @param source - original source

 @param lfs - per-file LFS context

 @returns zero or one diagnostics
 */
function checkRelativeUrl({
  node,
  source,
  lfs,
}: CheckUrlParams,): readonly Diagnostic[] {
  /**
   Repo-relative path the destination names, when it stays inside the root.
   */
  const [repoRelativePath,] = relativeTargetPath({
    url: node.url,
    filePath: lfs.filePath,
    repoRoot: lfs.repoRoot,
  },);
  if (repoRelativePath === undefined) {
    return [];
  }
  /**
   What the destination resolves to.
   */
  const target = lfs.resolveTarget(repoRelativePath,);
  if (target.kind !== 'lfs') {
    return [];
  }
  return [rewriteDiagnostic({
    node,
    source,
    message: 'Image targets an LFS-tracked file, which GitHub renders from the pointer as broken; use the object URL.',
    replacement: objectUrl({
      lfs,
      oid: target.oid,
      repoRelativePath,
    },),
  },),];
}

/**
 Check a destination already under the object base: the embedded oid must
 match the file's current oid, the path must still exist, and a target that
 stopped being LFS-tracked returns to a relative link.

 @param node - node whose URL is checked

 @param source - original source

 @param lfs - per-file LFS context

 @returns zero or one diagnostics
 */
function checkObjectUrl({
  node,
  source,
  lfs,
}: CheckUrlParams,): readonly Diagnostic[] {
  /**
   Embedded oid and path, when the destination is a complete object URL.
   */
  const [parts,] = objectUrlParts({
    url: node.url,
    objectBase: lfs.objectBase,
  },);
  if (parts === undefined) {
    return [];
  }
  /**
   Embedded oid and path of the object URL.
   */
  const {
    oid,
    repoRelativePath,
  } = parts;
  /**
   What the embedded path resolves to now.
   */
  const target = lfs.resolveTarget(repoRelativePath,);
  if (target.kind === 'missing') {
    return [diagnose({
      ruleId: ID,
      message: `Object URL names ${repoRelativePath}, which no longer exists in the repository.`,
      node: node as UrlNode,
    },),];
  }
  if (target.kind === 'plain') {
    /**
     Relative link from the file's directory back to the target.
     */
    const relativeLink = relative(
      dirname(lfs.filePath,),
      resolve(
        lfs.repoRoot,
        ...repoRelativePath.split('/',),
      ),
    )
      .split(sep,)
      .join(posix.sep,);
    return [rewriteDiagnostic({
      node,
      source,
      message: `Object URL names ${repoRelativePath}, which is no longer LFS-tracked; link it relatively.`,
      replacement: relativeLink,
    },),];
  }
  if (target.oid === oid) {
    return [];
  }
  return [rewriteDiagnostic({
    node,
    source,
    message: `Object URL oid is stale for ${repoRelativePath}; update it to the file's current oid.`,
    replacement: objectUrl({
      lfs,
      oid: target.oid,
      repoRelativePath,
    },),
  },),];
}

/**
 Identifiers of every image reference in the tree, so only definitions that
 images use are rewritten; a definition used by links alone keeps its target.

 @param context - rule context

 @returns set of referenced identifiers
 */
function imageReferenceIdentifiers(context: RuleContext,): ReadonlySet<string> {
  /**
   Identifiers collected across the walk.
   */
  const identifiers = new Set<string>();
  for (const { node, } of walk(context.tree,)) {
    if (node.type === 'imageReference') {
      identifiers.add(node.identifier,);
    }
  }
  return identifiers;
}

/**
 Rewrite Markdown images whose target is an LFS-tracked file into object
 URLs on the repository's LFS server, and keep existing object URLs in step
 with the files they name. Inert when the run found no `.lfsconfig`.

 @param context - tree, source, MDX flag, and the per-file LFS context

 @returns one diagnostic per image or image definition needing a change
 */
function checkLfsImageUrl(context: RuleContext,): readonly Diagnostic[] {
  /**
   Per-file LFS context and source, when the rule applies.
   */
  const {
    lfs,
    source,
  } = context;
  if (lfs === undefined) {
    return [];
  }
  /**
   Definitions that image references resolve to.
   */
  const imageDefinitions = imageReferenceIdentifiers(context,);
  /**
   Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const { node, } of walk(context.tree,)) {
    if ((node.type !== 'image') && (node.type !== 'definition')) {
      continue;
    }
    if ((node.type === 'definition') && (!imageDefinitions.has(node.identifier,))) {
      continue;
    }
    if (node.url
      .startsWith(`${lfs.objectBase}/`,)) {
      diagnostics.push(...checkObjectUrl({
        node,
        source,
        lfs,
      },),);
      continue;
    }
    diagnostics.push(...checkRelativeUrl({
      node,
      source,
      lfs,
    },),);
  }
  return diagnostics;
}

/**
 lfs-image-url: Markdown images must not point at LFS-tracked files by
 relative path, because GitHub renders the pointer instead of the object.
 Fixable: rewrites the destination to `<objectBase>/<oid>/<repo path>` on
 the server `.lfsconfig` declares, refreshes a stale oid, and turns an object
 URL back into a relative link when its target leaves LFS.
 */
export const lfsImageUrl: Rule = {
  id: ID,
  fixable: true,
  check: checkLfsImageUrl,
};

import { hashContent, } from './document-node.ts';
import { foldInvisibleVariants, } from './invisible-variants.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationRootEntry, } from './preparation-root-population-model.ts';

//region Relations supported by the complete texts actually present in an entry

/**
 Checks represented entry texts, retained-line origins and local evidence bounds.
 Does not reparse MDX, classify declarations, remove stubs or infer unaligned section coverage.

 @internal

 @param entry - invocation-owned entry after every serialized field was decoded

 @param path - authored complete-entry position

 @throws PreparationRootError when entry identities, origins, eligibility role or evidence bounds differ

 @example
 ```ts
 verifyPreparationInputEntryRelations({ entry, path });
 ```
 */
export function verifyPreparationInputEntryRelations({
  entry,
  path,
}: {
  readonly entry: PreparationRootEntry;
  readonly path: string;
}): void {
  /**
   Already-decoded fields keep their source, archive and target roles explicit.
   */
  const {
    sourceText,
    archiveText,
    targetText,
    sourceHash,
    archiveHash,
    targetHash,
    originalPolicy,
    archiveLines,
    sourceFindings,
    targetFindings,
  } = entry;
  /**
   These identities describe separate stages and must not be substituted for one another.
   */
  const identities = [
    {
      field: 'sourceHash',
      content: sourceText,
      digest: sourceHash,
    },
    {
      field: 'archiveHash',
      content: archiveText,
      digest: archiveHash,
    },
    {
      field: 'targetHash',
      content: targetText,
      digest: targetHash,
    },
  ];
  for (const identity of identities) {
    if (hashContent({ content: identity.content, }) !== identity.digest)
      throw new PreparationRootError({
        kind: 'input-relations',
        input: `${path}.${identity.field}`,
      });
  }
  /**
   Root-entry production returns exclusions before emitting either whole-page classification.
   */
  const {
    inherited,
    normalized,
    spans,
  } = originalPolicy;
  if ((inherited === 'whole-page') || (normalized === 'whole-page'))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.originalPolicy`,
    });
  if (!spans.every(function bounded(span): boolean {
    return span.endOffset <= targetText.length;
  }))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.originalPolicy.spans`,
    });
  /**
   The shared character fold preserves LF positions and gives the actual retained-line origin domain.
   No stub-removal decision is repeated here.
   */
  const { text: folded, } = foldInvisibleVariants({ text: archiveText, });
  /**
   Each represented origin must identify an existing folded archive line.
   */
  const originalLines = folded.split('\n');
  /**
   The producer retains lines in strictly increasing original-file order.
   */
  const originsMatch = archiveLines.every(function origin(
    line,
    index,
  ): boolean {
    /**
     No previous origin exists only for the first represented retained line.
     */
    const previous = archiveLines[index - 1];
    return (originalLines[line.lineNumber - 1] === line.text)
      && ((previous === undefined) || (previous.lineNumber < line.lineNumber));
  });
  /**
   Joining represented lines verifies target text without claiming why other lines were removed.
   */
  const retainedLines = archiveLines.map(function text(line): string {
    return line.text;
  });
  if ((!originsMatch) || (retainedLines.join('\n') !== targetText))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.archiveLines`,
    });
  /**
   Parser intervals use their own complete document's UTF-16 coordinate domain.
   */
  const observations = [
    {
      field: 'sourceFindings',
      findings: sourceFindings,
      length: sourceText.length,
    },
    {
      field: 'targetFindings',
      findings: targetFindings,
      length: targetText.length,
    },
  ];
  for (const observation of observations) {
    /**
     Finding coordinates and document extent belong to this same observation domain.
     */
    const {
      findings,
      length,
    } = observation;
    if (!findings.every(function bounded(finding): boolean {
      return finding.endOffset <= length;
    }))
      throw new PreparationRootError({
        kind: 'input-relations',
        input: `${path}.${observation.field}`,
      });
  }
}

//endregion Relations supported by the complete texts actually present in an entry

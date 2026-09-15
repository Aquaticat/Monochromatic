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

 @returns Nothing when represented identities and local evidence are consistent

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
   These identities describe separate stages and must not be substituted for one another.
   */
  const identities = [
    {
      field: 'sourceHash',
      content: entry.sourceText,
      digest: entry.sourceHash,
    },
    {
      field: 'archiveHash',
      content: entry.archiveText,
      digest: entry.archiveHash,
    },
    {
      field: 'targetHash',
      content: entry.targetText,
      digest: entry.targetHash,
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
  const { originalPolicy, } = entry;
  if ((originalPolicy.inherited === 'whole-page') || (originalPolicy.normalized === 'whole-page'))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.originalPolicy`,
    });
  if (!originalPolicy.spans.every(function bounded(span): boolean {
    return span.endOffset <= entry.targetText.length;
  }))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.originalPolicy.spans`,
    });
  /**
   The shared character fold preserves LF positions and gives the actual retained-line origin domain.
   No stub-removal decision is repeated here.
   */
  const folded = foldInvisibleVariants({ text: entry.archiveText, });
  /**
   Each represented origin must identify an existing folded archive line.
   */
  const originalLines = folded.text.split('\n');
  /**
   The producer retains lines in strictly increasing original-file order.
   */
  const originsMatch = entry.archiveLines.every(function origin(
    line,
    index,
  ): boolean {
    /**
     No previous origin exists only for the first represented retained line.
     */
    const previous = entry.archiveLines[index - 1];
    return (originalLines[line.lineNumber - 1] === line.text)
      && ((previous === undefined) || (previous.lineNumber < line.lineNumber));
  });
  /**
   Joining represented lines verifies target text without claiming why other lines were removed.
   */
  const retainedLines = entry.archiveLines.map(function text(line): string {
    return line.text;
  });
  if ((!originsMatch) || (retainedLines.join('\n') !== entry.targetText))
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
      findings: entry.sourceFindings,
      length: entry.sourceText.length,
    },
    {
      field: 'targetFindings',
      findings: entry.targetFindings,
      length: entry.targetText.length,
    },
  ];
  for (const observation of observations) {
    if (!observation.findings.every(function bounded(finding): boolean {
      return finding.endOffset <= observation.length;
    }))
      throw new PreparationRootError({
        kind: 'input-relations',
        input: `${path}.${observation.field}`,
      });
  }
}

//endregion Relations supported by the complete texts actually present in an entry

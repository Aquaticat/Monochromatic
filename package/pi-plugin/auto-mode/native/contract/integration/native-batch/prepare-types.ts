/**
 Native preparation phases share captured import resolution and one generated output directory.

 @module
 */
import type { ImportEntryReader } from './build-entries.ts';
import type { createNativeImportRewriter } from './build-rebase.ts';

//region Captured build inputs reach each original source preparation phase

/**
 Source phases use the same captured manifests and original static import mapping.
 */
export type NativePreparationInput = {
  /** Directory receiving generated native modules from this build occurrence. */
  readonly output: string;
  /** Pure selector over manifests captured before source transformation. */
  readonly entry: ImportEntryReader;
  /** Qualified static import rewriter retaining original source-relative resolution. */
  readonly imports: ReturnType<typeof createNativeImportRewriter>;
};

//endregion Captured build inputs reach each original source preparation phase

/** Readable policy file declarations follow the maintained custody implementation. @module */
import type {
  ContextPromptInput,
  ReadablePolicyFiles
} from './policy-loader-types.ts';

/**
 Bind only context entries whose contents match an actual readable file.

 @param contextInputs - complete published context input sequence
 */
export function bindReadablePolicyFiles(contextInputs: readonly ContextPromptInput[]): ReadablePolicyFiles;

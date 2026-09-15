/**
 Git index and tree mode mapping shared by candidate and tracked-file facts.

 @module
 */
import type { CandidateFileMode, } from '../api/policy-types.ts';

/**
 Git index mode mapping.
 */
export const INDEX_MODES: Readonly<Record<string, CandidateFileMode>> = {
  '100644': 'regular',
  '100755': 'executable',
  '120000': 'symlink',
  '160000': 'submodule',
};

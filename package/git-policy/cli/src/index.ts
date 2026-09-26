#!/usr/bin/env node
/**
 Cli-git authoring exports and direct executable entry.
 
 @module
 */

import { runCliGit, } from './bin.ts';

export * from './authoring.ts';
/**
 Manual-push candidate materialization exposed for built-artifact verification.

 @internal
 */
export { createManualPushCandidates, } from './policy-engine/manual-push-candidates.ts';
/**
 Manual-push update discovery exposed for built-artifact verification.

 @internal
 */
export {
  ManualPushProbeError,
  probeManualPushUpdates,
} from './policy-engine/manual-push-probe.ts';
/**
 Raw diff-tree record parsing exposed for built-artifact verification.

 @internal
 */
export { parseRawDiffRecords, } from './policy-engine/raw-diff-records.ts';

// Direct execution runs the wrapper; module import remains inert.
if (import.meta.main)
  await runCliGit();

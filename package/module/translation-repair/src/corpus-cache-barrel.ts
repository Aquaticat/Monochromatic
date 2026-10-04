/**
 Re-exports of the slice cache's namespace surface, kept beside its module so
 the corpus barrel stays under its line budget (ledger MXL).

 @module
 */

export {
  belongsToNamespace,
  CONSOLIDATE_NAMESPACE,
  discardNamespace,
  EVERY_SLICE_NAMESPACE,
  loadNamespacedSlices,
  PICTURE_READING_NAMESPACE,
  REPAIR_SLICE_NAMESPACE,
  sliceFileName,
  type SliceNamespace,
  TRANSLATE_SLICE_NAMESPACE,
} from './corpus-run/slice-cache-namespace.ts';

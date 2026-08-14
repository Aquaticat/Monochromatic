import { crossFileRows, } from './readonly-origin-producer.ts';

//region Cross-file consumer

/**
 * Rows inferred from separate project-owned producer.
 */
const rows = crossFileRows([1,],);

/**
 * Reads inferred row across source boundary.
 */
export const matchingRows = rows.filter(function matchingCrossFile(entry,) {
  return entry.value > 0;
},);

//endregion Cross-file consumer

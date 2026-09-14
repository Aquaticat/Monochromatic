/**
 Fixed metadata ceilings protect host allocation independently from supplied extents or JSON contents.
 */
export const PRODUCER_INPUT_METADATA_BYTES = 1_048_576;
/**
 Native metadata commands are bounded separately from the child application's execution deadline.
 */
export const PRODUCER_INPUT_COMMAND_TIMES = {
  /**
   Local image, create, inspect, stop and removal calls cannot wait indefinitely.
   */
  metadataMilliseconds: 30_000,
  /**
   Attached startup allows the fixed child deadline plus native exit bookkeeping.
   */
  attachedMilliseconds: 330_000,
  /**
   An unresponsive native client receives forced termination after its first signal.
   */
  terminationGraceMilliseconds: 2_000,
} as const;

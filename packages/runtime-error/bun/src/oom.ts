export {};

/** Size of each allocation in bytes -- large enough to exhaust memory in a few iterations */
const CHUNK_SIZE_BYTES = 256 * 1_024 * 1_024;

/**
 * Intentionally triggers an out-of-memory crash by pushing 256 MB `Buffer`
 * chunks into an array without releasing them, until the process runs out of
 * heap space.
 */
const chunks: Buffer[] = [];

// oxlint-disable-next-line no-constant-condition -- intentional infinite loop to exhaust memory
while (true) {
  chunks.push(Buffer.alloc(CHUNK_SIZE_BYTES,),);
  console.log(`Allocated ${chunks.length * CHUNK_SIZE_BYTES / 1_024 / 1_024} MB`,);
}

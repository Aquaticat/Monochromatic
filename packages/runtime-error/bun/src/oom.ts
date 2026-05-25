import { BYTES_PER_MIB, } from '@monochromatic-dev/module-numeric-const';

export {};

/** Number of mebibytes per allocation chunk: large enough to exhaust memory in a few iterations. */
const CHUNK_SIZE_MIB = 256;

/** Size of each allocation in bytes. */
const CHUNK_SIZE_BYTES = CHUNK_SIZE_MIB * BYTES_PER_MIB;

/**
 * Intentionally triggers an out-of-memory crash by pushing 256 MB `Buffer`
 * chunks into an array without releasing them, until the process runs out of
 * heap space.
 */
const chunks: Buffer[] = [];

// oxlint-disable-next-line no-constant-condition -- intentional infinite loop to exhaust memory
while (true) {
  chunks.push(Buffer.alloc(CHUNK_SIZE_BYTES,),);
  console.log(`Allocated ${chunks.length
    * CHUNK_SIZE_MIB} MB`,);
}

import type { BigIntStats, } from 'node:fs';
import { lstat, } from 'node:fs/promises';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import type { ProducerInputComparisonRun, } from './producer-input-comparison-storage.ts';
import { sameProducerInputFile, } from './producer-input-file.ts';

//region Created descriptor identity must still name the observed private file

/**
 Comparison metadata and streams retain exact private file permissions.
 */
const FILE_MODE = 0o600n;
/**
 Special permission bits remain part of the comparison.
 */
const MODE_MASK = 0o7777n;

/**
 Cross-checks a real created descriptor snapshot against the current final pathname.
 The caller captures this snapshot from its live FileHandle after synchronization;
 the type alone authenticates nothing and this check does not create a filesystem lease.
 
 @param path - fixed owned comparison file role
 
 @param expected - actual descriptor observation retained before path-based byte verification
 
 @param run - independently captured namespace ownership
 
 @param failure - owning write or read boundary's fixed diagnostic kind
 
 @param l - invoking operation logger
 
 @throws ProducerInputComparisonError when identity, mutation timestamps or private ownership differs
 
 @example
 ```ts
 await verifyProducerInputComparisonFile({ path, expected, run, failure: 'storage', l });
 ```
 */
export async function verifyProducerInputComparisonFile({
  path,
  expected,
  run,
  failure,
  l,
}: {
  readonly path: string;
  readonly expected: BigIntStats;
  readonly run: ProducerInputComparisonRun;
  readonly failure: 'storage' | 'output';
  readonly l: Logger;
},): Promise<void> {
  /**
   Diagnostics never forward file contents or native exception messages.
   */
  const pl = tagged({
    tag: verifyProducerInputComparisonFile.name,
    l,
  });
  try {
    /**
     A pathname replacement cannot substitute even identical bytes for the created descriptor.
     */
    const actual = await lstat(
      path,
      { bigint: true }
    );
    /**
     Shared identity comparison includes replacement and mutation timestamps.
     */
    const sameDescriptor = sameProducerInputFile({
      before: expected,
      after: actual,
    });
    if ((!expected.isFile()) || (!sameDescriptor)
      || (actual.uid !== BigInt(run.uid))
      || (actual.gid !== BigInt(run.gid))
      || ((actual.mode & MODE_MASK) !== FILE_MODE))
      throw new ProducerInputComparisonError({
        kind: failure,
        directory: run.directory
      });
    pl.debug('verified created comparison descriptor against final private pathname');
  }
  catch (error) {
    pl.warn(`comparison file observation failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}`);
    throw new ProducerInputComparisonError({
      kind: failure,
      directory: run.directory
    });
  }
}

//endregion Created descriptor identity must still name the observed private file

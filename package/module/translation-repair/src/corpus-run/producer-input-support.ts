import {
  lstat,
  realpath,
} from 'node:fs/promises';
import {
  isAbsolute,
  join,
  relative,
  sep,
} from 'node:path';
import { isNativeError, } from 'node:util/types';
import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';
import { mapOverlapped, } from '../overlapped-map.ts';
import type { PreparationArtifactInput, } from '../preparation-selection-evidence-model.ts';
import type { FrozenPreparationSelection, } from '../preparation-selection-model.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import {
  readProducerInputFile,
  type ProducerInputFileIdentity,
} from './producer-input-file.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';

//region Exact task40 reference loading after the runtime gate

/**
 Reference stat results retain the original logical locator separately from the fixed container mount.
 
 @example
 ```ts
 const file: ProducerSupportingFile = { locator, mountedPath, identity };
 ```
 */
type ProducerSupportingFile = {
  /**
   Original byte-bound reference spelling, never rewritten in the semantic input inventory.
   */
  readonly locator: string;
  /**
   Canonical path under the fixed read-only supporting mount.
   */
  readonly mountedPath: string;
  /**
   Fresh extent paired with the independently digest-bound reference hash.
   */
  readonly identity: ProducerInputFileIdentity;
};

/**
 Maps one approved reference into the fixed mount and measures it without reading its body.
 
 @param hostRoot - canonical host root declared by the launch
 
 @param reference - original locator and hash from the independently verified selection
 
 @param l - owning loader logger
 
 @returns Regular-file extent before aggregate allocation is authorized
 
 @throws ProducerInputRunError when the reference escapes its root or is not a readable canonical regular file
 
 @example
 ```ts
 const file = await statProducerSupportingFile({ hostRoot, reference, l });
 ```
 */
async function statProducerSupportingFile({
  hostRoot,
  reference,
  l,
}: {
  readonly hostRoot: string;
  readonly reference: FrozenPreparationSelection['references'][number];
  readonly l: Logger;
},): Promise<ProducerSupportingFile> {
  /**
   This operation reports names and metadata only.
   */
  const pl = tagged({
    tag: statProducerSupportingFile.name,
    l,
  },);
  /**
   Path mapping never changes the locator supplied to semantic byte matching.
   */
  const mapped = relative(
    hostRoot,
    reference.path
  );
  if ((mapped === '') || (mapped === '..')
    || mapped.startsWith(`..${sep}`)
    || isAbsolute(mapped))
    throw new ProducerInputRunError({
      operation: 'read-support',
      locator: reference.path,
    });
  /**
   Container paths are derived only after root membership is checked.
   */
  const mountedPath = join(
    PRODUCER_INPUT_PATHS.supporting,
    mapped
  );
  pl.debug(`measuring registered supporting input ${JSON.stringify(reference.path)}`);
  try {
    /**
     Canonical spelling refuses observed symlink traversal through either the leaf or its parents.
     */
    const canonical = await realpath(mountedPath);
    if (canonical !== mountedPath)
      throw new ProducerInputRunError({
        operation: 'read-support',
        locator: reference.path,
      });
    /**
     BigInt stat does not silently round an extent before the allocation decision.
     */
    const state = await lstat(
      mountedPath,
      { bigint: true, }
    );
    if ((!state.isFile()) || (state.size < 0n)
      || (state.size > BigInt(Number.MAX_SAFE_INTEGER)))
      throw new ProducerInputRunError({
        operation: 'read-support',
        locator: reference.path,
      });
    return {
      locator: reference.path,
      mountedPath,
      identity: {
        bytes: Number(state.size),
        sha256: reference.hash,
      },
    };
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    pl.warn(`supporting input metadata failed with ${Error.isError(error,) ? error.name : typeof error}; native details were not retained`);
    throw new ProducerInputRunError({
      operation: 'read-support',
      locator: reference.path,
    });
  }
}

/**
 Loads exactly the selection's reference inventory after every extent fits the caller-authorized envelope.
 No recursive discovery, historical-source execution or model request occurs.
 
 @param selection - freshly verified frozen selection, not a caller-fabricated reference table
 
 @param hostRoot - independently declared canonical host supporting root
 
 @param maximumBytes - caller-authorized aggregate byte allowance
 
 @param l - application logger retaining input-run ownership
 
 @returns Owned raw bytes with their original frozen locators
 
 @throws ProducerInputRunError when metadata, budget, content identity or observed path stability fails
 
 @example
 ```ts
 const artifacts = await readProducerSupportingFiles({ selection, hostRoot, maximumBytes, l });
 ```
 */
export async function readProducerSupportingFiles({
  selection,
  hostRoot,
  maximumBytes,
  l,
}: {
  readonly selection: FrozenPreparationSelection;
  readonly hostRoot: string;
  readonly maximumBytes: number;
  readonly l: Logger;
},): Promise<readonly PreparationArtifactInput[]> {
  /**
   Every sub-operation retains the named input owner.
   */
  const pl = tagged({
    tag: readProducerSupportingFiles.name,
    l,
  },);
  if ((!Number.isSafeInteger(maximumBytes)) || (maximumBytes < 0))
    throw new ProducerInputRunError({
      operation: 'read-support',
      locator: hostRoot,
    });
  /**
   Serial metadata reads complete before any supporting body is loaded.
   */
  const files = await mapOverlapped({
    items: selection.references,
    overlap: 1,
    oneItem: async function measured({ item, }): Promise<ProducerSupportingFile> {
      return await statProducerSupportingFile({
        hostRoot,
        reference: item,
        l: pl,
      });
    },
  });
  /**
   Aggregate allowance is explicit launch authority, not an inferred package-wide ceiling.
   */
  const total = files.reduce(
    function add(
      sum,
      file
    ): number { return sum
      + file.identity
      .bytes; },
    0
  );
  if ((!Number.isSafeInteger(total)) || (total > maximumBytes))
    throw new ProducerInputRunError({
      operation: 'read-support',
      locator: hostRoot,
    });
  pl.info(`loading ${String(files.length)} registered supporting files within ${String(maximumBytes)} authorized bytes`);
  return await mapOverlapped({
    items: files,
    overlap: 1,
    oneItem: async function loaded({ item, }): Promise<PreparationArtifactInput> {
      /**
       This callback owns one file's descriptor and final-path observation.
       */
      const rl = tagged({
        tag: loaded.name,
        l: pl,
      });
      try {
        /**
         Descriptor-backed reading freshly checks the exact stat extent and frozen raw hash.
         */
        const content = await readProducerInputFile({
          path: item.mountedPath,
          expected: item.identity,
          operation: 'read-support',
        });
        /**
         A changed parent-path resolution is not silently accepted after body reading.
         */
        const canonical = await realpath(item.mountedPath);
        if (canonical !== item.mountedPath)
          throw new ProducerInputRunError({
            operation: 'read-support',
            locator: item.locator,
          });
        return {
          path: item.locator,
          content,
        };
      }
      catch (error) {
        if (error instanceof ProducerInputRunError)
          throw error;
        rl.warn(`supporting input read failed with ${Error.isError(error,) ? error.name : typeof error}; native details were not retained`);
        throw new ProducerInputRunError({
          operation: 'read-support',
          locator: item.locator,
        });
      }
    },
  });
}

//endregion Exact task40 reference loading after the runtime gate

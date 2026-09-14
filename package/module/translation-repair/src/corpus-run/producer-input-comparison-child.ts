import { opendir, } from 'node:fs/promises';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import {
  type ProducerInputComparisonRun,
  verifyProducerInputComparisonRun,
  writeProducerInputComparisonRecord,
} from './producer-input-comparison-storage.ts';

//region Bounded failure-time association without trusting success stdout

/**
 Directory-entry observations do not authenticate creation or qualify their contents.
 
 @example
 ```ts
 const child: ProducerInputComparisonChild = { name, kind: 'directory' };
 ```
 */
export type ProducerInputComparisonChild = {
  /**
   Direct child name is retained only as private metadata.
   */
  readonly name: string;
  /**
   Filesystem entry kind, not a semantic result or completed run.
   */
  readonly kind: 'directory' | 'file' | 'symlink' | 'other';
};

/**
 More than one observed entry is enough to refuse association without enumerating an unbounded directory.
 A single entry must still pass the separate run, completion and artifact readers.
 
 @example
 ```ts
 if (observation.state !== 'single') throw new ProducerInputComparisonError({ kind: 'output' });
 ```
 */
export type ProducerInputComparisonChildObservation = {
  /**
   Empty, exactly one observed entry, or at least two observed entries.
   */
  readonly state: 'absent' | 'single' | 'ambiguous';
  /**
   At most the first two native entries, with no inferred total beyond them.
   */
  readonly children: readonly ProducerInputComparisonChild[];
  /**
   False explicitly records that ambiguity stopped further enumeration.
   */
  readonly completeEnumeration: boolean;
};

/**
 Observes the dedicated native output parent after actual bootstrap close, including failure paths.
 This operation never searches a shared output root or selects one entry from an ambiguous set.
 
 @param run - created private comparison namespace and its dedicated producer-runs parent
 
 @param l - invoking comparison owner's logger
 
 @returns Persisted bounded entry observations without any completion or review assertion
 
 @throws ProducerInputComparisonError when directory observation or record persistence fails
 
 @example
 ```ts
 const observation = await observeProducerInputComparisonChildren({ run, l });
 ```
 */
export async function observeProducerInputComparisonChildren({
  run,
  l,
}: {
  readonly run: ProducerInputComparisonRun;
  readonly l: Logger;
},): Promise<ProducerInputComparisonChildObservation> {
  /**
   No untrusted entry name is copied into public telemetry.
   */
  const pl = tagged({
    tag: observeProducerInputComparisonChildren.name,
    l
  });
  try {
    await verifyProducerInputComparisonRun({
      run,
      l: pl
    });
    /**
     Explicit disposal closes direct-read directory handles on every exit path.
     */
    await using directory = await opendir(run.inputParent);
    /**
     Absence is observed, never inferred from missing success stdout.
     */
    const first = await directory.read();
    /**
     A second entry proves ambiguity; no further entry needs to be read to refuse association.
     */
    const second = first === null ? null : await directory.read();
    /**
     Only actual metadata observations enter the retained child inventory.
     */
    const children: readonly ProducerInputComparisonChild[] = [
      first,
      second
    ]
      .filter(function present(entry): entry is NonNullable<typeof entry> { return entry !== null; })
      .map(function describeEntry(entry): ProducerInputComparisonChild {
        return {
          name: entry.name,
          kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : entry.isSymbolicLink() ? 'symlink' : 'other'
        };
      });
    /**
     This status is an observation, not an authorization to consume an entry.
     */
    const observation: ProducerInputComparisonChildObservation = {
      state: first === null ? 'absent' : second === null ? 'single' : 'ambiguous',
      children,
      completeEnumeration: second === null,
    };
    await writeProducerInputComparisonRecord({
      run,
      file: 'child-observation.json',
      value: {
        version: 1,
        kind: 'producer-preparation-input-child-observation',
        ...observation
      },
      l: pl,
    });
    pl.info(`retained native child observation ${observation.state}; no completion inferred`);
    return observation;
  }
  catch (error) {
    if (Error.isError(error) && (error instanceof ProducerInputComparisonError))
      throw error;
    pl.warn(`native child observation failed with ${Error.isError(error) ? 'an Error object' : 'a non-Error value'}`);
    throw new ProducerInputComparisonError({
      kind: 'output',
      directory: run.directory
    });
  }
}

//endregion Bounded failure-time association without trusting success stdout

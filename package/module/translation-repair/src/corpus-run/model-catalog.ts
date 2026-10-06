import { fetchTransport, } from '../synthetic-transport.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { printModelCatalog, } from './model-catalog-print.ts';

//region Model catalog drift
// Asks the provider what it currently serves and compares that against the
// catalog this pipeline compiles against: `model-catalog-print.ts` holds the
// procedure and `model-catalog-compare.ts` the comparison.

/**
 Prints the catalog drift over the process's own environment and the live
 transport. Not `async`: it hands the promise on, so a run that refuses before
 its first call leaves no continuation behind it that nothing runs.

 @example
 ```ts
 await printDrift();
 ```
 */
function printDrift(): Promise<void> {
  return printModelCatalog({
    env: process.env,
    transport: fetchTransport,
  },);
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await reportingRefusals({
    what: 'model-catalog',
    argv: process.argv,
    run: printDrift,
  },);

//endregion Model catalog drift

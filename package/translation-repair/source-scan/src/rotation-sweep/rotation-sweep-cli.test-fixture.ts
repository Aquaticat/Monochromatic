import { rotationSweepMain, } from './rotation-sweep.test-fixture.ts';

//region Rotation sweep command line
// THE ENTRY OF THE `test:rotation-sweep` TASK (ledger B701). The task runs this file
// with the words after its `--`. The report is written by `rotationSweepMain`; a sweep
// that is not clean ends in a thrown error, which is how the task exits non-zero.

if (!(await rotationSweepMain({ args: process.argv.slice(2,), },)))
  throw new Error('rotation sweep is not clean: the report printed by the sweep names each case and the salts that fail it',);

//endregion Rotation sweep command line

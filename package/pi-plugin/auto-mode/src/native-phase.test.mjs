/** Exercise native preparation, callbacks, updates, and execution through a real disposable Pi session. @module */
import {runNativePhaseCatalog} from './native-phase-catalog.ts';

//region The maintained task entry forwards one native phase mode to the typed catalog.
await runNativePhaseCatalog({
  requestedMode:process.argv[2]??'parallel',
  emitSummary:function emitNativePhaseSummary(summary){
    console.log(JSON.stringify(summary));
  }
});
//endregion

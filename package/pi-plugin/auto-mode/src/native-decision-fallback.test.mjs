import {runNativeDecisionFallbackCatalog} from './native-decision-fallback-catalog.ts';

//region The maintained task entry forwards one requested mode to the typed catalog.
await runNativeDecisionFallbackCatalog({
  requestedMode:process.argv[2]??'approve',
  emitSummary:function emitDecisionFallbackSummary(summary){
    console.log(JSON.stringify(summary));
  }
});
//endregion

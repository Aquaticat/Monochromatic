//region Corpus ceiling barrel
// The two ceilings a pass runs under and the scheduler's stop rule: the
// per-entry ceiling in minutes (`cap-override.ts`), the per-run spend ceiling
// in USD (`spend-ceiling.ts`), and the rule the attempt queue asks before each
// entry. Its own barrel because `corpus-barrel.ts` sits at the line cap.

export {
  capOutlastsOneCall,
  capTooTightNote,
  HARD_CAP_VAR,
  HardCapOverrideError,
  resolveHardCapMinutes,
} from './corpus-run/cap-override.ts';
export {
  resolveSpendCeilingUsd,
  SPEND_CEILING_PROVIDER,
  SPEND_CEILING_USD,
  SPEND_CEILING_VAR,
  spendCeilingNote,
  spendCeilingOverrideNote,
  spendCeilingReached,
  SpendCeilingOverrideError,
} from './corpus-run/spend-ceiling.ts';
export { stopBeforeNextEntry, } from './corpus-run/pass-stop-before-next.ts';

//endregion Corpus ceiling barrel
export {
  classifyInsertionCoverage,
  type InsertionCoverageRow,
} from './corpus-run/insertion-coverage-model.ts';
export {
  admitReferencedDefinitions,
  DEFINITION_ADMITTED_FINDING,
} from './corpus-run/insertion-referenced-definitions.ts';
export {
  admitContainerHalves,
  CONTAINER_HALF_ADMITTED_FINDING,
} from './corpus-run/insertion-container-halves.ts';
export {
  admitContainerDeficit,
  CONTAINER_DEFICIT_ADMITTED_FINDING,
  SPLIT_IN_CONTAINER_DEFICIT_FINDING,
} from './corpus-run/insertion-container-deficit.ts';
export {
  CARRIED_FOLDED_FINDING,
  foldCarriedInsertions,
} from './corpus-run/insertion-carried-fold.ts';

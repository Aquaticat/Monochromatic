//region Corpus overlap exports
// Public overlap dial vocabulary split from corpus-barrel.ts to keep its API
// inventory within the source line budget.

export {
  CALIBRATION_OVERLAP,
  type OverlapSetting,
  type OverlapSettingSource,
  readOverlap,
  readOverlapSetting,
} from './corpus-run/slice-overlap.ts';

export {
  CORPUS_CLONE_DIR_VAR,
  CORPUS_COMMIT_VAR,
  type CorpusPinSetting,
  type CorpusPinSource,
  readCorpusPinSetting,
} from './corpus-run/corpus-pin-override.ts';

//endregion Corpus overlap exports

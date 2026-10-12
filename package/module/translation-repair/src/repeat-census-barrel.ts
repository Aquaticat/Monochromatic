//region Repeat census barrel
// The repeat census's control decision and report, exported so each is tested
// where it is defined; the command that runs them is `corpus-run/repeat-census.ts`.

export {
  type ControlReading,
  controlReadingOf,
  coversAllLines,
  failedControlsOf,
  occupiedLinesOf,
} from './corpus-run/repeat-census-control.ts';
export {
  censusEntryOf,
  reportRepeatCensus,
} from './corpus-run/repeat-census-report.ts';

//endregion Repeat census barrel

//region Control barrel
// The gates that decide whether a reading is worth believing, and the cuts they
// damage a document with.
//
// Split out of `corpus-barrel.ts` when that file reached its line budget, on
// the same AUDIENCE grounds that file records for its own split: these symbols
// exist to answer "can this instrument see the thing it is about to be asked
// about", which is a question asked BEFORE a measurement rather than during
// one. Nothing in a corpus run reaches them.
//
// Every cut here is exported so it can be exercised on fixtures. A control is
// worth exactly as much as its damage is real, and damage first seen at the end
// of a draw that already spent its quota is damage nobody checked.

export {
  decoyCut,
  type DecoyCut,
} from './corpus-run/coverage-control-decoy.ts';
export {
  coverageControlHolds,
  type CoverageControlCase,
  type CoverageControlResult,
  type CoverageControlRow,
  withoutSpans,
} from './corpus-run/coverage-control.ts';
export {
  widthControlHolds,
  withoutASentence,
} from './corpus-run/editor-width-control.ts';

//endregion Control barrel

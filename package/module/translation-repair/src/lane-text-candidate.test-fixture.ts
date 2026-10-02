import type {
  Candidate,
  LaneText,
  TranslateCandidateValue,
} from '../dist/final/node/index.mjs';

//region Lane text candidate
// A LANE TEXT RENDERED AS A FRESH CANDIDATE, as the consolidation offers lane
// texts beside the proposals a slate already carries.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The slate-decline-ships-by-preference and
// translate-retry tests kept their own copy of this projection; both now
// import it from here.

/**
 Renders one lane text as a candidate the slate can carry.

 @param laneText - lane text the consolidation offers

 @returns Fresh candidate carrying that lane's text

 @example
 ```ts
 const candidate = toLaneCandidate(REPAIR_LANE,);
 ```
 */
export function toLaneCandidate(laneText: LaneText,): Candidate<TranslateCandidateValue> {
  return {
    producer: {
      kind: 'lane',
      lane: laneText.lane,
      matched: [],
    },
    value: {
      text: laneText.text,
      origin: 'fresh',
    },
    rendered: laneText.text,
  };
}

//endregion Lane text candidate

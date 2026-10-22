/**
 Holds the three contest formats to the vocabularies their guards read (P1 of the second review of the Claude route).
 A live Claude call under the lane contest's schema returned `"verdict": "Consistent"`, valid under a plain string and
 refused by `isLaneContestWire`, which reads `verdict` against the candidate names plus the refusal and
 `verdictOnArchive` against the archive verdicts. The consolidation gate and the polish gate build the same format over
 their own names. Each case compares the format the stage sends with the constant its guard reads, imported from the
 module that owns the guard.

 The findings lists stay plain strings in all three: a finding may annotate the candidate it names, and the reader takes
 the name from the start of the finding.

 Nothing here reaches a provider: the schemas are read, never sent.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CONSOLIDATE_GATE_NAMES,
  CONSOLIDATE_GATE_RESPONSE_FORMAT,
  CONSOLIDATION_POLISH_GATE_RESPONSE_FORMAT,
  POLISH_NAMES,
} from '@monochromatic-dev/translation-repair-consolidate';
import {
  ARCHIVE_VERDICTS,
  CANDIDATE_NAMES,
  LANE_CONTEST_RESPONSE_FORMAT,
} from '@monochromatic-dev/translation-repair-lane-contest';

await describe({
  name: 'the contest formats',
  concurrency: 1,
  children: [
    it({
      name: 'LISTS THE LANE CONTEST\'S VERDICT AS AN enum OF CANDIDATE_NAMES AND ITS ARCHIVE VERDICT AS ONE OF '
        + 'ARCHIVE_VERDICTS, the constants isLaneContestWire reads, and keeps the findings plain',
      fn: async () => {
        expect(LANE_CONTEST_RESPONSE_FORMAT.json_schema.schema.properties,).toEqual({
          assessment: { type: 'string', },
          dropped: { type: 'array', items: { type: 'string', }, },
          unsupported: { type: 'array', items: { type: 'string', }, },
          verdict: { type: 'string', enum: [...CANDIDATE_NAMES,], },
          verdictOnArchive: { type: 'string', enum: [...ARCHIVE_VERDICTS,], },
        },);
      },
    },),

    it({
      name: 'LISTS THE CONSOLIDATION GATE\'S VERDICT AS AN enum OF ITS GUARD\'S NAMES and asks no archive verdict, since its '
        + 'standing choice is the archive',
      fn: async () => {
        expect(CONSOLIDATE_GATE_RESPONSE_FORMAT.json_schema.schema.properties,).toEqual({
          assessment: { type: 'string', },
          dropped: { type: 'array', items: { type: 'string', }, },
          unsupported: { type: 'array', items: { type: 'string', }, },
          verdict: { type: 'string', enum: [...CONSOLIDATE_GATE_NAMES,], },
        },);
      },
    },),

    it({
      name: 'LISTS THE POLISH GATE\'S VERDICT AS AN enum OF POLISH_NAMES and asks no archive verdict',
      fn: async () => {
        expect(CONSOLIDATION_POLISH_GATE_RESPONSE_FORMAT.json_schema.schema.properties,).toEqual({
          assessment: { type: 'string', },
          dropped: { type: 'array', items: { type: 'string', }, },
          unsupported: { type: 'array', items: { type: 'string', }, },
          verdict: { type: 'string', enum: [...POLISH_NAMES,], },
        },);
      },
    },),
  ],
},);

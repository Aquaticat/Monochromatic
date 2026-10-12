/**
 Tests for asking the judge bench about every group that needs it: nobody to
 ask reads no seats, a group whose handling breaks outside the bench's own
 containment stops the pass with the failure of the first, and the failure of
 each other group is written under the name of the group asked.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  askAll,
  type PreparedGroup,
  type RosterModelId,
} from '../../dist/final/node/index.mjs';
import { warnLinesDuring, } from '../console-warn-lines.test-fixture.ts';
import { HANG_STOP_MS, } from '../hang-stop.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { SCRIPTED_STAGE_SETTINGS, } from '../stage-settings.test-fixture.ts';
import {
  firstPlaceWins,
  PAGE_SOURCE,
  scriptedJudgeClient,
} from './consistency-page.test-fixture.ts';
import { DIGEST, } from './consistency-run.test-fixture.ts';

/**
 Logger the bench writes to.
 */
const l = tagged({ tag: 'pass-consistency-bench-test', },);

/**
 A group that lists no place, which the pass never builds and the bench cannot
 word.

 @returns The group with its places, both empty

 @example
 ```ts
 const broken = placelessGroup();
 ```
 */
function placelessGroup(): PreparedGroup {
  return {
    group: { kind: 'maximal', length: 12, occurrences: [], unplaced: [], },
    places: [],
  };
}

await describe({
  name: askAll.name,
  concurrency: 1,
  children: [
    it({
      name: 'ASKS NOBODY AND READS NO SEATS FOR NO GROUP TO ASK, since a page that needs no judge waits out no hold',
      fn: async () => {
        await using dir = await scratchDir({ prefix: 'pass-consistency-bench-', },);
        /**
         Seats the client was asked.
         */
        const asked: RosterModelId[] = [];
        expect(await askAll({
          client: scriptedJudgeClient({ behave: firstPlaceWins, asked, sheets: [], },),
          text: PAGE_SOURCE,
          toAsk: [],
          entryCacheDir: dir.path,
          pipelineDigest: DIGEST,
          signal: AbortSignal.timeout(HANG_STOP_MS,),
          overlap: 2,
          l,
          stageSettings: SCRIPTED_STAGE_SETTINGS,
        },),).toEqual([],);
        expect(asked,).toEqual([],);
      },
    },),
    it({
      name: 'THROWS THE FIRST GROUP\'S FAILURE AND WRITES THE SECOND\'S UNDER ITS NAME when two groups break outside '
        + 'the bench\'s containment',
      fn: async () => {
        await using dir = await scratchDir({ prefix: 'pass-consistency-bench-', },);
        const { result: refusal, warned, } = await warnLinesDuring({
          run: async function askBoth(): Promise<string> {
            try {
              await askAll({
                client: scriptedJudgeClient({ behave: firstPlaceWins, asked: [], sheets: [], },),
                text: PAGE_SOURCE,
                toAsk: [placelessGroup(), placelessGroup(),],
                entryCacheDir: dir.path,
                pipelineDigest: DIGEST,
                signal: AbortSignal.timeout(HANG_STOP_MS,),
                overlap: 2,
                l,
                stageSettings: SCRIPTED_STAGE_SETTINGS,
              },);
            }
            catch (error) {
              return String(error,);
            }
            return 'settled';
          },
        },);
        expect(refusal,).toBe(
          'ConsistencyInvariantError: unreachable: a repeat group lists no place, and the detector reports a repeat only '
            + 'where it stands in two',
        );
        expect(warned.some(function namesTheSecond(line,): boolean {
          return line.includes(
            'group 2 asked failed (unreachable: a repeat group lists no place, and the detector reports a repeat only where '
              + "it stands in two), and the failure thrown is group 1 asked's",
          );
        },),).toBe(true,);
      },
    },),
  ],
},);

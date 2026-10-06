import { artifactsDirOf, } from './artifact-file-name.ts';
import { readRunJson, } from '../run-json-read.ts';
import { scoreProbeAgainstGrades, } from '../probe-agreement.ts';
import {
  parseGradedRepairSheet,
  readSheetIdentity,
} from '../repair-grade-read.ts';
import { parseSampleManifest, } from '../sample-manifest.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import {
  assertSheetMatchesManifest,
  HEADER_ONLY_BINDING_NOTE,
} from '../sheet-binding.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { reportProbeTelemetry, } from './probe-telemetry-report.ts';
import { requireArtifactsDir, } from './score-artifacts-dir.ts';
import {
  countRefinedJoined,
  joinProbeGrades,
  printProbeAgreement,
} from './score-probe-agreement.ts';
import { gatherProbeReadings, } from './score-probe-gather.ts';
import { readSheetText, } from './score-sheet-text.ts';

//region Score probe run
// Reports what the shadow-mode introduced-defect probe found across a run's
// settled artifacts, so the gate question can be answered with a measurement.
//
// Prints COUNTS ONLY. Artifacts quote UNLICENSED corpus text, and this output
// is meant to be pasteable into a verdict or a message, so nothing it emits
// carries a quote, a claim, or an envelope id.
//
// This number is NOT a precision on its own. It says how often the probe would
// have blocked a repair; whether it was RIGHT to needs the human repair grades
// beside it, which is the comparison this exists to enable.

/**
 Reads a run's artifacts and prints the probe summary.

 @param runsDir - runs directory the report describes, which the first line names

 @param line - the probe's command line, read whole by `reportingRefusals`

 @throws {@link StatedRefusalError} when only one of `--repair-sheet` and `--manifest`
 is named, when the runs directory holds no readable `artifacts` directory, when
 the repair sheet cannot be read, or when the sheet and the manifest differ in length

 @example
 ```ts
 await printProbeScore({ runsDir, line, },);
 ```
 */
export async function printProbeScore(
  {
    runsDir,
    line,
  }: {
    readonly runsDir: string;
    readonly line: CommandLineOf<'score-probe'>;
  },
): Promise<void> {
  /**
   Graded repair sheet named, if any.
   */
  const sheet = line.flag('repair-sheet',);

  /**
   Its draw manifest named, if any.
   */
  const manifestFile = line.flag('manifest',);

  // ONE WITHOUT THE OTHER IS REFUSED before anything is read: the report used
  // to print its unscored note and drop the file that was named (ledger B75).
  if ((sheet.kind === 'written') !== (manifestFile.kind === 'written'))
    throw new StatedRefusalError({
      says: '--repair-sheet and --manifest score the probe against the human grades together; name both, or '
        + 'neither for the telemetry alone',
    },);

  /**
   Directory this run wrote artifacts into.
   */
  const artifactsDir = artifactsDirOf({ runsDir, },);

  // NAMES THE RUN IT READ, first line, always. `resolveRunsDir` falls back to a
  // default when TRANSLATION_REPAIR_RUNS_DIR is unset, so a report can describe
  // a different run than the reader has in mind and every count it prints will look
  // like an answer about theirs. Pointing this at the wrong directory produced a
  // clean set of zeros that read as "nothing to report" rather than as "wrong
  // run", which is the failure this whole project keeps rediscovering.
  console.log(`SOURCE ${artifactsDir}`,);
  await requireArtifactsDir({ artifactsDir, },);

  /**
   Readings across every settled artifact.
   */
  const gathered = await gatherProbeReadings({ artifactsDir, },);

  reportProbeTelemetry({ gathered, },);
  if ((sheet.kind === 'unwritten') || (manifestFile.kind === 'unwritten')) {
    console.log(
      'NOTE majorityIntroduced counts regions a gate WOULD have blocked, not '
        + 'regions that were damaged. Pass --repair-sheet PATH --manifest PATH '
        + 'to score it against the human grades.',
    );
    return;
  }

  /**
   Graded repair sheet and its draw manifest, both named.
   */
  const joinPaths = {
    sheet: sheet.value,
    manifest: manifestFile.value,
  };

  /**
   Draw manifest, the only record of which issue sat at which position.
   */
  const manifest = parseSampleManifest({
    value: await readRunJson({ path: joinPaths.manifest, },),
  },);

  /**
   Sheet contents, read once and used for both identity and verdicts.
   */
  const sheetText = await readSheetText({
    path: joinPaths.sheet,
    label: 'graded repair sheet',
    remedy: 'name the sheet that exists with --repair-sheet',
  },);

  /**
   How firmly the sheet is tied to this manifest; refuses if it is not.
   */
  const binding = assertSheetMatchesManifest({
    identity: readSheetIdentity({ text: sheetText, },),
    manifest,
    sheetLabel: 'repair sheet',
    sheetPath: joinPaths.sheet,
    manifestPath: joinPaths.manifest,
  },);
  if (binding === 'header-only')
    console.log(HEADER_ONLY_BINDING_NOTE,);

  /**
   Graded issues paired with the probe reading of the same issue.
   */
  const items = joinProbeGrades({
    manifest,
    graded: parseGradedRepairSheet({ text: sheetText, },),
    byIssueId: gathered.byIssueId,
  },);

  printProbeAgreement({
    agreement: scoreProbeAgainstGrades({ items, },),
    refinedJoined: countRefinedJoined({
      manifest,
      refinedIssueIds: gathered.refinedIssueIds,
    },),
  },);
}

//endregion Score probe run

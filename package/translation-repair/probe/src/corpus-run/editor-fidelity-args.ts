import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary/ts';
import { wordForCount, } from '@monochromatic-dev/translation-repair-typography/ts';
import {
  type CommandLineOf,
  type FlagValue,
  idListFlag,
  usdFlag,
  wholeNumberFlag,
} from '@monochromatic-dev/translation-repair-run/ts';
import {
  EDITOR_DAMAGE_KINDS,
  type EditorDamageKind,
} from '../editor-fidelity-trials.ts';

//region Editor fidelity arguments
// What the editor fidelity probe is asked on its command line, kept beside the probe so the probe itself stays under
// the file-length cap. The flags are the judge fidelity probe's, less `--context`, which has no meaning for an editor,
// and with the amount the run may spend.

/**
 How many trials one invocation runs by default, counted in attempts like the judge probe's own: enough for every trial
 of the frozen pool, so an arm run with no `--cap` asks them all and every arm sees the same ones.
 */
export const DEFAULT_EDITOR_TRIAL_CAP = 64;

/**
 Most a run may spend, in US dollars, when `--max-usd` is not written: the spend guard refuses the call that would take
 the spend measured from the replies, plus that call's ceiling, past it.
 */
export const DEFAULT_EDITOR_MAX_USD = 2;

/**
 Spells the defects `--damage` takes, the last one joined by "or".

 @returns The defects in list order

 @example
 ```ts
 const spelled = damageSpellings(); // 'insertion or alteration'
 ```
 */
function damageSpellings(): string {
  return EDITOR_DAMAGE_KINDS.join(' or ',);
}

/**
 Reads which defects `--damage` asks for.

 @param damage - what the flag carried, or that nobody wrote it

 @returns Every defect the probe builds when the flag was not written, else the one named

 @throws StatedRefusalError when the flag names a deletion, with why it is not built, or a spelling this probe does
 not build

 @example
 ```ts
 const kinds = damageKindsOf({ damage: { kind: 'written', flag: '--damage', value: 'insertion', }, },);
 ```
 */
function damageKindsOf({ damage, }: { readonly damage: FlagValue; },): readonly EditorDamageKind[] {
  if (damage.kind === 'unwritten')
    return EDITOR_DAMAGE_KINDS;
  /**
   The defect that spelling names, absent when it names none this probe builds.
   */
  const named = EDITOR_DAMAGE_KINDS.find(function is(kind,): boolean {
    return kind === damage.value;
  },);
  if (named !== undefined)
    return [named,];
  if (damage.value === 'deletion') {
    throw new StatedRefusalError({
      says: `${damage.flag} deletion is not built for the editor probe: its fix is a sentence the editor must write, `
        + `which no deterministic test scores against the archive's wording; the probe takes ${
         damageSpellings()}`,
    },);
  }
  throw new StatedRefusalError({
    says: `${damage.flag} takes ${damageSpellings()}, not ${JSON.stringify(damage.value,)}`,
  },);
}

/**
 Reads `--only`, `--cap`, `--damage` and `--max-usd` from the command line.

 @internal

 @param line - the probe's command line, read whole by `reportingRefusals` and passed in so this is testable without a
 subprocess

 @returns Entry ids to trial, empty for every entry, the trial cap, the defects to build and the most the run may cost

 @throws StatedRefusalError when a cap is not a whole number written in digits or is below zero, an amount is not a
 plain decimal, or a defect is one this probe does not build

 @example
 ```ts
 const { onlyIds, cap, damageKinds, maxUsd, } = readEditorFidelityArguments({ line, },);
 ```
 */
export function readEditorFidelityArguments(
  { line, }: { readonly line: CommandLineOf<'editor-fidelity-probe'>; },
): {
  readonly onlyIds: readonly string[];
  readonly cap: number;
  readonly damageKinds: readonly EditorDamageKind[];
  readonly maxUsd: number;
} {
  /**
   Defects to build, read before the other flags so a bad one is refused first.
   */
  const damageKinds = damageKindsOf({ damage: line.flag('damage',), },);
  return {
    damageKinds,
    onlyIds: idListFlag({
      asked: line.flag('only',),
      naming: 'entry id',
    },),
    cap: wholeNumberFlag({
      asked: line.flag('cap',),
      unwritten: DEFAULT_EDITOR_TRIAL_CAP,
      leaveOffTo: `run the default of ${String(DEFAULT_EDITOR_TRIAL_CAP,)} ${
        wordForCount({
          count: DEFAULT_EDITOR_TRIAL_CAP,
          one: 'trial',
          many: 'trials',
        },)
      }`,
    },),
    maxUsd: usdFlag({
      asked: line.flag('max-usd',),
      unwritten: DEFAULT_EDITOR_MAX_USD,
    },),
  };
}

//endregion Editor fidelity arguments

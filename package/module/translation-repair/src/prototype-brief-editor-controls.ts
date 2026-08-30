// PROTOTYPE ONLY: Candidate C pure contract controls.

import {
  type EditorialPacket,
  selectFixedPriorityEditor,
  sourceUnitsFor,
  validateBriefEditorCandidate,
  validatePreparationBrief,
} from './prototype-brief-editor-plan.ts';
import {
  isBriefEditorDocument,
  isPreparationBrief,
  type BriefEditorDocument,
  type PreparationBrief,
} from './prototype-brief-editor-wire.ts';

function expectRefusal(
  { name, invoke, }: { readonly name: string; readonly invoke: () => void; },
): void {
  let refused = false;
  try {
    invoke();
  }
  catch (error) {
    refused = error !== undefined;
  }
  if (!refused)
    throw new Error(`brief editor ${name} control did not refuse`);
}

export function runBriefEditorLocalControls(): void {
  const sourceText = '猫安歇。';
  const archiveText = 'Cats rest.';
  const units = sourceUnitsFor({ sourceText, });
  if ((units.length !== 1) || (units[0]?.text !== sourceText))
    throw new Error('brief editor source-unit positive control failed');
  const validBrief: PreparationBrief = {
    summary: 'Located source obligation.',
    items: [{
      anchorDomain: 'source',
      anchor: '安歇',
      defectClass: 'wrong-meaning',
      instruction: 'Carry rest meaning.',
    },],
  };
  validatePreparationBrief({
    brief: validBrief,
    sourceText,
    archiveText,
    mediaNames: new Set(),
    domains: new Set(['source',]),
    defectClasses: new Set(['wrong-meaning',]),
  },);
  for (const [name, brief,] of [
    ['unlocated-anchor', { ...validBrief, items: [{ ...validBrief.items[0]!, anchor: '不存在', },], },],
    ['outside-class', { ...validBrief, items: [{ ...validBrief.items[0]!, defectClass: 'grammar', },], },],
    ['duplicate-item', { ...validBrief, items: [validBrief.items[0]!, validBrief.items[0]!,], },],
  ] as const) {
    expectRefusal({
      name,
      invoke: function rejectBrief() {
        validatePreparationBrief({
          brief,
          sourceText,
          archiveText,
          mediaNames: new Set(),
          domains: new Set(['source',]),
          defectClasses: new Set(['wrong-meaning',]),
        },);
      },
    },);
  }
  const packet: EditorialPacket = {
    sourceUnits: units,
    lockedContributorForms: [],
    mediaNames: [],
    missingBriefNodes: [],
    items: [{ briefId: 'source-brief/0', authorNodeId: 'source-brief', ...validBrief.items[0]!, },],
  };
  const response: BriefEditorDocument = {
    document: archiveText,
    realizations: [{ sourceUnitId: units[0]!.id, targetQuote: 'Cats', },],
    briefDispositions: [{ briefId: 'source-brief/0', disposition: 'applied', reason: 'Rest retained.', },],
  };
  validateBriefEditorCandidate({ response, packet, sourceText, archiveText, sourcePictures: [], },);
  for (const [name, changed,] of [
    ['source-unit-id', { ...response, realizations: [{ ...response.realizations[0]!, sourceUnitId: 'wrong/0', },], },],
    ['target-quote', { ...response, realizations: [{ ...response.realizations[0]!, targetQuote: 'Dogs', },], },],
    ['brief-disposition', { ...response, briefDispositions: [], },],
  ] as const) {
    expectRefusal({
      name,
      invoke: function rejectCandidate() {
        validateBriefEditorCandidate({
          response: changed,
          packet,
          sourceText,
          archiveText,
          sourcePictures: [],
        },);
      },
    },);
  }
  if (isPreparationBrief({ summary: '', items: [{ anchorDomain: 'bad', },], },))
    throw new Error('preparation brief wire guard accepted invalid response');
  if (isBriefEditorDocument({ document: archiveText, realizations: [], briefDispositions: [{}], },))
    throw new Error('brief editor wire guard accepted invalid response');
  const selected = selectFixedPriorityEditor({
    usable: new Map([
      ['fallback-editor', 'finished-first',],
      ['primary-editor', 'finished-later',],
    ]),
  },);
  if ((selected?.id !== 'primary-editor') || (selected.value !== 'finished-later'))
    throw new Error('brief editor fixed-priority control failed');
}

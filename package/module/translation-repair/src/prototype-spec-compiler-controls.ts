// PROTOTYPE ONLY: Candidate B deterministic contract controls.

import { sourceUnitsFor, } from './prototype-brief-editor-plan.ts';
import {
  compilerBaseDigest,
  selectCompilerFallback,
  validateSpecification,
} from './prototype-spec-compiler-plan.ts';
import {
  adoptCompilerRole,
  validateCompilerDocument,
} from './prototype-spec-compiler-transaction.ts';
import type {
  CompilerDocument,
  SpecificationResponse,
} from './prototype-spec-compiler-wire.ts';

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
    throw new Error(`specification compiler ${name} control did not refuse`);
}

export function runSpecificationCompilerControls(): void {
  const sourceText = '猫安歇。';
  const archiveText = 'Cats rest.';
  const units = sourceUnitsFor({ sourceText, });
  const specification: SpecificationResponse = {
    summary: 'Carry rest meaning.',
    units: [{ sourceUnitId: units[0]!.id, obligations: ['Cat rests.',], },],
  };
  validateSpecification({ response: specification, sourceUnits: units, },);
  expectRefusal({
    name: 'specification-id',
    invoke: function rejectSpecification() {
      validateSpecification({
        response: { ...specification, units: [{ ...specification.units[0]!, sourceUnitId: 'wrong/0', },], },
        sourceUnits: units,
      },);
    },
  },);
  const renderer: CompilerDocument = {
    mode: 'render',
    baseDigest: null,
    document: archiveText,
    realizations: [{ sourceUnitId: units[0]!.id, targetQuote: 'Cats', occurrence: 1, },],
    changes: [],
  };
  validateCompilerDocument({
    response: renderer,
    expectedMode: 'render',
    expectedBaseDigest: null,
    sourceText,
    archiveText,
    sourceUnits: units,
    sourcePictures: [],
    allowedKinds: new Set(),
  },);
  const baseDigest = compilerBaseDigest({ base: archiveText, });
  const revision: CompilerDocument = {
    mode: 'revision',
    baseDigest,
    document: 'Cats sleep.',
    realizations: [{ sourceUnitId: units[0]!.id, targetQuote: 'Cats', occurrence: 1, },],
    changes: [{
      before: 'rest',
      after: 'sleep',
      sourceQuote: '安歇',
      kind: 'wrong-meaning',
      explanation: 'Fixture correction.',
    },],
  };
  const located = validateCompilerDocument({
    response: revision,
    expectedMode: 'revision',
    expectedBaseDigest: baseDigest,
    sourceText,
    archiveText,
    sourceUnits: units,
    sourcePictures: [],
    base: archiveText,
    allowedKinds: new Set(['wrong-meaning',]),
  },);
  const first = adoptCompilerRole({
    current: archiveText,
    accepted: [],
    response: revision,
    located,
    validate: function validate() {},
  },);
  if ((!first.applied) || (first.document !== 'Cats sleep.'))
    throw new Error('specification compiler valid transaction control failed');
  expectRefusal({
    name: 'transaction-replay',
    invoke: function rejectReplay() {
      validateCompilerDocument({
        response: { ...revision, document: 'Cats run.', },
        expectedMode: 'revision',
        expectedBaseDigest: baseDigest,
        sourceText,
        archiveText,
        sourceUnits: units,
        sourcePictures: [],
        base: archiveText,
        allowedKinds: new Set(['wrong-meaning',]),
      },);
    },
  },);
  const conflict: CompilerDocument = {
    ...revision,
    document: 'Cats nap.',
    changes: [{ ...revision.changes[0]!, after: 'nap', },],
  };
  const conflictLocated = validateCompilerDocument({
    response: conflict,
    expectedMode: 'revision',
    expectedBaseDigest: baseDigest,
    sourceText,
    archiveText,
    sourceUnits: units,
    sourcePictures: [],
    base: archiveText,
    allowedKinds: new Set(['wrong-meaning',]),
  },);
  const preserved = adoptCompilerRole({
    current: first.document,
    accepted: first.accepted,
    response: conflict,
    located: conflictLocated,
    validate: function validate() {},
  },);
  if (preserved.applied || (preserved.document !== first.document))
    throw new Error('specification compiler conflict preservation control failed');
  const selected = selectCompilerFallback({
    usable: new Map([
      ['expression-specialist', 'finished-first',],
      ['fidelity-specialist', 'finished-later',],
    ]),
  },);
  if ((selected?.id !== 'fidelity-specialist') || (selected.value !== 'finished-later'))
    throw new Error('specification compiler fallback priority control failed');
}

// PROTOTYPE ONLY: Candidate B three bounded execution waves.

import type { SyntheticClient, } from './chat-contract.ts';
import type { SourceUnit, } from './prototype-brief-editor-plan.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import {
  executeStructuredNode,
  type BriefEditorNodeRecord,
  restartStructuredNode,
  settleStructuredNode,
} from './prototype-brief-editor-runtime.ts';
import {
  rendererMessages,
  specialistMessages,
  specificationMessages,
} from './prototype-spec-compiler-input.ts';
import {
  type CompilerSpecificationPacket,
  COMPILER_SPECIALISTS,
  RENDERER_NODE,
  SPECIFICATION_NODE,
  validateSpecification,
} from './prototype-spec-compiler-plan.ts';
import {
  type LocatedCompilerChange,
  validateCompilerDocument,
} from './prototype-spec-compiler-transaction.ts';
import {
  COMPILER_DOCUMENT_RESPONSE_FORMAT,
  type CompilerDocument,
  isCompilerDocument,
  isSpecificationResponse,
  SPECIFICATION_RESPONSE_FORMAT,
  type SpecificationResponse,
} from './prototype-spec-compiler-wire.ts';

export type CompilerNodeState<ValueT,> = {
  readonly record: BriefEditorNodeRecord;
  readonly value?: ValueT;
  readonly located?: readonly LocatedCompilerChange[];
};

export async function runSpecificationWave(
  {
    outputDir,
    client,
    manifestDigest,
    sourceText,
    archiveText,
    sourceUnits,
    media,
    restart,
    signal,
  }: {
    readonly outputDir: string;
    readonly client: SyntheticClient;
    readonly manifestDigest: string;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourceUnits: readonly SourceUnit[];
    readonly media: readonly PrototypeMedia[];
    readonly restart: boolean;
    readonly signal: AbortSignal;
  },
): Promise<CompilerNodeState<SpecificationResponse>> {
  const messages = specificationMessages({ sourceText, archiveText, media, });
  if (restart) {
    const stored = await restartStructuredNode({
      outputDir,
      id: SPECIFICATION_NODE.id,
      modelId: SPECIFICATION_NODE.modelId,
      manifestDigest,
      messages,
      responseFormat: SPECIFICATION_RESPONSE_FORMAT,
      validate: isSpecificationResponse,
      signal,
    },);
    if (stored.kind === 'usable') {
      validateSpecification({ response: stored.value, sourceUnits, },);
      return { record: stored.record, value: stored.value, };
    }
    if (stored.kind === 'unusable')
      return { record: stored.record, };
  }
  const execution = await executeStructuredNode({
    outputDir,
    client,
    id: SPECIFICATION_NODE.id,
    modelId: SPECIFICATION_NODE.modelId,
    manifestDigest,
    messages,
    responseFormat: SPECIFICATION_RESPONSE_FORMAT,
    validate: isSpecificationResponse,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    validateSpecification({ response: execution.value, sourceUnits, },);
  }
  catch (error) {
    return { record: await settleStructuredNode({
      outputDir,
      execution,
      usable: false,
      failureType: Error.isError(error,) ? error.constructor.name : 'unknown',
      failure: error,
    },), };
  }
  return {
    record: await settleStructuredNode({ outputDir, execution, usable: true, },),
    value: execution.value,
  };
}

export async function runRendererWave(
  {
    outputDir,
    client,
    manifestDigest,
    sourceText,
    archiveText,
    sourceUnits,
    sourcePictures,
    specification,
    media,
    restart,
    signal,
  }: {
    readonly outputDir: string;
    readonly client: SyntheticClient;
    readonly manifestDigest: string;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourceUnits: readonly SourceUnit[];
    readonly sourcePictures: readonly { readonly assetName: string; }[];
    readonly specification: CompilerSpecificationPacket;
    readonly media: readonly PrototypeMedia[];
    readonly restart: boolean;
    readonly signal: AbortSignal;
  },
): Promise<CompilerNodeState<CompilerDocument>> {
  const messages = rendererMessages({ sourceText, archiveText, specification, media, });
  const validateValue = function validateValue(value: CompilerDocument,): void {
    validateCompilerDocument({
      response: value,
      expectedMode: 'render',
      expectedBaseDigest: null,
      sourceText,
      archiveText,
      sourceUnits,
      sourcePictures,
      allowedKinds: new Set(),
    },);
  };
  if (restart) {
    const stored = await restartStructuredNode({
      outputDir,
      id: RENDERER_NODE.id,
      modelId: RENDERER_NODE.modelId,
      manifestDigest,
      messages,
      responseFormat: COMPILER_DOCUMENT_RESPONSE_FORMAT,
      validate: isCompilerDocument,
      signal,
    },);
    if (stored.kind === 'usable') {
      validateValue(stored.value,);
      return { record: stored.record, value: stored.value, };
    }
    if (stored.kind === 'unusable')
      return { record: stored.record, };
  }
  const execution = await executeStructuredNode({
    outputDir,
    client,
    id: RENDERER_NODE.id,
    modelId: RENDERER_NODE.modelId,
    manifestDigest,
    messages,
    responseFormat: COMPILER_DOCUMENT_RESPONSE_FORMAT,
    validate: isCompilerDocument,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    validateValue(execution.value,);
  }
  catch (error) {
    return { record: await settleStructuredNode({
      outputDir,
      execution,
      usable: false,
      failureType: Error.isError(error,) ? error.constructor.name : 'unknown',
      failure: error,
    },), };
  }
  return {
    record: await settleStructuredNode({ outputDir, execution, usable: true, },),
    value: execution.value,
  };
}

export async function runSpecialistWave(
  {
    outputDir,
    client,
    manifestDigest,
    sourceText,
    archiveText,
    sourceUnits,
    sourcePictures,
    specification,
    base,
    baseDigest,
    media,
    restart,
    signal,
  }: {
    readonly outputDir: string;
    readonly client: SyntheticClient;
    readonly manifestDigest: string;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourceUnits: readonly SourceUnit[];
    readonly sourcePictures: readonly { readonly assetName: string; }[];
    readonly specification: CompilerSpecificationPacket;
    readonly base?: string;
    readonly baseDigest: string | null;
    readonly media: readonly PrototypeMedia[];
    readonly restart: boolean;
    readonly signal: AbortSignal;
  },
): Promise<readonly CompilerNodeState<CompilerDocument>[]> {
  return await Promise.all(COMPILER_SPECIALISTS.map(async function specialistNode(specialist,) {
    const messages = specialistMessages({
      specialist,
      sourceText,
      archiveText,
      specification,
      ...(base === undefined ? {} : { base, }),
      media,
    },);
    const validateValue = function validateValue(value: CompilerDocument,): readonly LocatedCompilerChange[] {
      return validateCompilerDocument({
        response: value,
        expectedMode: base === undefined ? 'fallback' : 'revision',
        expectedBaseDigest: baseDigest,
        sourceText,
        archiveText,
        sourceUnits,
        sourcePictures,
        ...(base === undefined ? {} : { base, }),
        allowedKinds: new Set(specialist.allowedKinds,),
      },);
    };
    if (restart) {
      const stored = await restartStructuredNode({
        outputDir,
        id: specialist.id,
        modelId: specialist.modelId,
        manifestDigest,
        messages,
        responseFormat: COMPILER_DOCUMENT_RESPONSE_FORMAT,
        validate: isCompilerDocument,
        signal,
      },);
      if (stored.kind === 'usable')
        return { record: stored.record, value: stored.value, located: validateValue(stored.value,), };
      if (stored.kind === 'unusable')
        return { record: stored.record, };
    }
    const execution = await executeStructuredNode({
      outputDir,
      client,
      id: specialist.id,
      modelId: specialist.modelId,
      manifestDigest,
      messages,
      responseFormat: COMPILER_DOCUMENT_RESPONSE_FORMAT,
      validate: isCompilerDocument,
      signal,
    },);
    if (execution.kind === 'unusable')
      return { record: execution.record, };
    try {
      const located = validateValue(execution.value,);
      return {
        record: await settleStructuredNode({ outputDir, execution, usable: true, },),
        value: execution.value,
        located,
      };
    }
    catch (error) {
      return { record: await settleStructuredNode({
        outputDir,
        execution,
        usable: false,
        failureType: Error.isError(error,) ? error.constructor.name : 'unknown',
        failure: error,
      },), };
    }
  },));
}

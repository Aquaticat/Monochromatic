// PROTOTYPE ONLY: Candidate E1 double-prime restartable audit node.

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { SyntheticClient, VisionMessage, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type {
  ConditionalAuditResponse,
  ConditionalCandidate,
} from './prototype-conditional-audit-model.ts';
import {
  admitConditionalAudit,
  type ConditionalAuditNode,
  conditionalAuditResponseFormat,
  conditionalAuditStructuralGuard,
} from './prototype-conditional-audit-plan.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import {
  executeSlotNode,
  restartSlotNode,
  settleSlotNode,
  type SlotNodeRecord,
} from './prototype-slot-runtime.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';
import { join, } from 'node:path';

export type ConditionalAuditState = {
  readonly record: SlotNodeRecord;
  readonly response?: ConditionalAuditResponse;
  readonly rejectedFindingCount: number;
};

async function persistAdmission(
  {
    outputDir,
    id,
    record,
    shell,
    candidates,
    response,
  }: {
    readonly outputDir: string;
    readonly id: string;
    readonly record: SlotNodeRecord;
    readonly shell: ImmutableShell;
    readonly candidates: readonly ConditionalCandidate[];
    readonly response: ConditionalAuditResponse;
  },
): Promise<ConditionalAuditState> {
  const admission = admitConditionalAudit({ shell, candidates, response, });
  await writePrototypeJson({
    path: join(outputDir, `admission-${id}.json`,),
    value: {
      id,
      structuralResponseDigest: record.responseDigest,
      admittedResponseDigest: hashContent({ content: JSON.stringify(admission.response,), }),
      rejectedFindings: admission.rejectedFindings,
    },
  },);
  return {
    record,
    response: admission.response,
    rejectedFindingCount: admission.rejectedFindings.length,
  };
}

export async function runConditionalAuditNode(
  {
    outputDir,
    client,
    stage,
    node,
    manifestDigest,
    messages,
    shell,
    candidates,
    restart,
    signal,
  }: {
    readonly outputDir: string;
    readonly client: SyntheticClient;
    readonly stage: 'author-audit' | 'post-audit';
    readonly node: ConditionalAuditNode;
    readonly manifestDigest: string;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly shell: ImmutableShell;
    readonly candidates: readonly ConditionalCandidate[];
    readonly restart: boolean;
    readonly signal: AbortSignal;
  },
): Promise<ConditionalAuditState> {
  const id = `${stage}-${node.id}`;
  const responseFormat = conditionalAuditResponseFormat({ shell, candidates, });
  const validate = conditionalAuditStructuralGuard({ shell, candidates, });
  if (restart) {
    const stored = await restartSlotNode({
      outputDir,
      id,
      modelId: node.modelId,
      manifestDigest,
      messages,
      responseFormat,
      validate,
      signal,
    },);
    if (stored.kind === 'usable')
      return await persistAdmission({ outputDir, id, record: stored.record, shell, candidates, response: stored.value, });
    if (stored.kind === 'unusable')
      return { record: stored.record, rejectedFindingCount: 0, };
  }
  const execution = await executeSlotNode({
    outputDir,
    client,
    id,
    modelId: node.modelId,
    manifestDigest,
    messages,
    responseFormat,
    validate,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, rejectedFindingCount: 0, };
  const record = await settleSlotNode({ outputDir, execution, usable: true, },);
  return await persistAdmission({ outputDir, id, record, shell, candidates, response: execution.value, });
}

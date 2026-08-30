// PROTOTYPE ONLY: Candidate E1 double-prime zero-spend full-graph client.

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { carriesPicture, type SyntheticClient, } from './chat-contract.ts';
import type {
  ConditionalAuditFinding,
  ConditionalAuditResponse,
} from './prototype-conditional-audit-model.ts';
import type { ImmutableShell, SlotDocumentResponse, } from './prototype-slot-model.ts';

function systemText({ request, }: { readonly request: Parameters<SyntheticClient['chatJson']>[0]; }): string {
  const message = request.messages[0];
  return (message === undefined) || (typeof message.content !== 'string') ? '' : message.content;
}

function userText({ request, }: { readonly request: Parameters<SyntheticClient['chatJson']>[0]; }): string {
  const message = request.messages[1];
  if ((message === undefined) || !Array.isArray(message.content))
    return '';
  const part = message.content.find(function text(item,) { return item.type === 'text'; },);
  return (part === undefined) || (part.type !== 'text') ? '' : part.text;
}

function jsonSection(
  {
    text,
    marker,
    endMarker,
  }: {
    readonly text: string;
    readonly marker: string;
    readonly endMarker?: string;
  },
): unknown {
  const start = text.indexOf(marker,);
  if (start < 0)
    throw new Error(`scripted conditional prompt omitted ${marker}`);
  const valueStart = start + marker.length;
  const end = endMarker === undefined ? text.length : text.indexOf(endMarker, valueStart,);
  if (end < 0)
    throw new Error(`scripted conditional prompt omitted ${endMarker}`);
  return JSON.parse(text.slice(valueStart, end,).trim(),) as unknown;
}

function findingFor(
  {
    shell,
    candidate,
    slotIndex,
    defectClass,
  }: {
    readonly shell: ImmutableShell;
    readonly candidate: SlotDocumentResponse;
    readonly slotIndex: number;
    readonly defectClass: ConditionalAuditFinding['defectClass'];
  },
): ConditionalAuditFinding {
  const slot = shell.slots[slotIndex];
  if (slot === undefined)
    throw new Error(`scripted conditional slot absent at ${String(slotIndex,)}`);
  const candidateValue = candidate.slots[slot.key];
  if (candidateValue === undefined)
    throw new Error(`scripted conditional candidate slot absent at ${slot.key}`);
  return {
    slotKey: slot.key,
    defectClass,
    sourceAnchor: slot.source.slice(0, 100,),
    candidateAnchor: candidateValue.slice(0, 100,),
  };
}

function scriptedAuthor(
  {
    shell,
    authorId,
    invalid,
  }: {
    readonly shell: ImmutableShell;
    readonly authorId: string;
    readonly invalid: boolean;
  },
): SlotDocumentResponse {
  const slots = Object.fromEntries(shell.slots
    .filter(function retained(_slot, index,) { return !(invalid && (index === 0)); },)
    .map(function pair(slot,) {
      const prior = shell.body[slot.startOffset - 1];
      const leadingSpace = (prior !== undefined) && (prior.trim() !== '') ? ' ' : '';
      return [slot.key, `${leadingSpace}English text for ${slot.key} by ${authorId}.`,];
    },),);
  return { slots, };
}

function scriptedAudit(
  {
    shell,
    candidates,
    postRegression,
  }: {
    readonly shell: ImmutableShell;
    readonly candidates: Readonly<Record<string, { readonly slots: Readonly<Record<string, string>>; }>>;
    readonly postRegression: boolean;
  },
): ConditionalAuditResponse {
  const ids = Object.keys(candidates,);
  const isPost = ids.includes('baseline',) && ids.includes('resolution',);
  if (isPost) {
    const baseline = candidates.baseline;
    const resolution = candidates.resolution;
    if ((baseline === undefined) || (resolution === undefined))
      throw new Error('scripted conditional post candidates absent');
    const baselineResponse: SlotDocumentResponse = { slots: baseline.slots, };
    const resolutionResponse: SlotDocumentResponse = { slots: resolution.slots, };
    return {
      candidates: {
        baseline: { findings: [findingFor({ shell, candidate: baselineResponse, slotIndex: 4, defectClass: 'wrong-meaning', }),], },
        resolution: {
          findings: postRegression
            ? [findingFor({ shell, candidate: resolutionResponse, slotIndex: 5, defectClass: 'unsupported-addition', }),]
            : [],
        },
      },
    };
  }
  const candidateRecords = Object.fromEntries(ids.map(function candidateRecord(id, index,) {
    const candidate = candidates[id];
    if (candidate === undefined)
      throw new Error(`scripted conditional author candidate absent at ${id}`);
    const response: SlotDocumentResponse = { slots: candidate.slots, };
    const findingCount = id === 'fallback-author' ? 1 : 2;
    return [id, {
      findings: Array.from({ length: findingCount, }, function finding(_unused, findingIndex,) {
        return findingFor({
          shell,
          candidate: response,
          slotIndex: (index * 2) + findingIndex + 2,
          defectClass: findingIndex === 0 ? 'wrong-meaning' : 'omission',
        },);
      },),
    },];
  },),);
  return { candidates: candidateRecords, };
}

export function createConditionalScriptedClient(
  {
    shell,
    scenario,
  }: {
    readonly shell: ImmutableShell;
    readonly scenario: string;
  },
): SyntheticClient {
  return {
    chatText: async function unusedText() {
      await Promise.resolve();
      throw new Error('chatText unused by conditional shell prototype');
    },
    chatJson: async function scriptedJson(request,) {
      if (!carriesPicture({ messages: request.messages, },))
        throw new Error('scripted conditional shell call omitted images');
      const system = systemText({ request, });
      const text = userText({ request, });
      const schemaName = request.responseFormat?.json_schema.name;
      if (schemaName === 'immutable_shell_slots') {
        const roles = [
          { token: 'priority-zero', id: 'primary-author', },
          { token: 'priority-one', id: 'fallback-author', },
          { token: 'priority-two', id: 'reserve-author', },
          { token: 'conditional complete-document', id: 'conditional-resolver', },
        ].filter(function role(item,) { return system.includes(item.token,); },);
        const role = roles[0];
        if ((roles.length !== 1) || (role === undefined))
          throw new Error('scripted conditional slot role is ambiguous');
        if ((scenario === 'resolver-hang') && (role.id === 'conditional-resolver')) {
          console.log('PROTOTYPE scripted hang node=conditional-resolver',);
          for (let elapsedMs = 0; elapsedMs < 60_000; elapsedMs += 10) {
            if (request.signal.aborted)
              throw request.signal.reason;
            await wait(10,);
          }
        }
        const completeValue = role.id === 'conditional-resolver'
          ? function resolution(): SlotDocumentResponse {
            const base = jsonSection({
              text,
              marker: 'BASE SLOT RECORD:\n',
              endMarker: '\n\nBASE DOCUMENT:',
            },) as SlotDocumentResponse;
            const allowed = jsonSection({
              text,
              marker: 'ALLOWED SLOT KEYS:\n',
              endMarker: '\n\nBASE SLOT RECORD:',
            },) as readonly string[];
            const changed = scenario === 'resolver-unlocated'
              ? shell.slots.find(function unlocated(slot,) { return !allowed.includes(slot.key,); })?.key
              : allowed[0];
            if (changed === undefined)
              return base;
            return {
              slots: { ...base.slots, [changed]: `${base.slots[changed] ?? ''} Resolved.`, },
            };
          }()
          : scriptedAuthor({
            shell,
            authorId: role.id,
            invalid: (scenario === 'all-author-invalid')
              || ((scenario === 'primary-invalid') && (role.id === 'primary-author'))
              || ((scenario === 'single-author') && (role.id !== 'primary-author')),
          },);
        const value = (scenario === 'resolver-invalid') && (role.id === 'conditional-resolver')
          ? {
            slots: Object.fromEntries(Object.entries(completeValue.slots,).slice(1,),),
          }
          : completeValue;
        const rawText = JSON.stringify(value,);
        return request.validate(value,)
          ? { kind: 'ok', value, rawText, }
          : {
            kind: 'schema-mismatch',
            rawText,
            reason: 'caller-guard-rejected',
            detail: 'guard rejected scripted conditional slots',
          };
      }
      if (schemaName !== 'conditional_shell_audit')
        throw new Error('scripted conditional shell received unknown schema');
      const evidence = jsonSection({ text, marker: 'CANDIDATES:\n', },) as readonly {
        readonly id: string;
        readonly slots: Readonly<Record<string, string>>;
      }[];
      const candidates = Object.fromEntries(evidence.map(function candidate(item,) {
        return [item.id, { slots: item.slots, },];
      },),);
      const isPost = 'baseline' in candidates;
      if (((scenario === 'post-hang') && isPost) || ((scenario === 'author-audit-hang') && !isPost)) {
        console.log(`PROTOTYPE scripted hang node=${isPost ? 'post-audit' : 'author-audit'}`,);
        for (let elapsedMs = 0; elapsedMs < 60_000; elapsedMs += 10) {
          if (request.signal.aborted)
            throw request.signal.reason;
          await wait(10,);
        }
      }
      const onePostRegression = (scenario === 'post-one-regression')
        && isPost
        && system.includes('actor, chronology, reference, and register auditor');
      const complete = scriptedAudit({
        shell,
        candidates,
        postRegression: (scenario === 'post-regression') || onePostRegression,
      },);
      const onePostInvalid = (scenario === 'post-one-invalid')
        && isPost
        && system.includes('actor, chronology, reference, and register auditor');
      const value = ((scenario === 'post-invalid') && isPost)
        || onePostInvalid
        || ((scenario === 'author-audit-invalid') && !isPost)
        ? { candidates: {}, }
        : complete;
      const rawText = JSON.stringify(value,);
      return request.validate(value,)
        ? { kind: 'ok', value, rawText, }
        : {
          kind: 'schema-mismatch',
          rawText,
          reason: 'caller-guard-rejected',
          detail: 'guard rejected scripted conditional audit',
        };
    },
    quotas: async function unusedQuotas() {
      await Promise.resolve();
      throw new Error('quotas unused by conditional shell prototype');
    },
  };
}

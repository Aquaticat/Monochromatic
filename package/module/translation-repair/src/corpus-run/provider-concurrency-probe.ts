// PROTOTYPE ONLY: live provider concurrency measurement with tiny unique tasks.

import { createHyperClient, } from '../hyper-client.ts';
import type { RosterModelId, } from '../roster-id.ts';
import {
  hyperIdFor,
  ROSTER_MODEL_IDS,
} from '../roster-reach.ts';
import {
  createSyntheticClient,
} from '../synthetic-client.ts';
import { syntheticServes, } from '../synthetic-catalog.ts';
import {
  fetchTransport,
  type ModelTransport,
  type TransportReply,
} from '../synthetic-transport.ts';
import { DEFAULT_RETRY_POLICY, } from '../transient-retry.ts';

const PROVIDER_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_PROVIDER';
const MODEL_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_MODEL';
const WIDTHS_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_WIDTHS';
const TIMEOUT_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_TIMEOUT_MS';
const TASK_BASE_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_TASK_BASE';
const STRUCTURED_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_STRUCTURED';
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_LOCAL_CONCURRENCY = 128;
const MAX_PROBE_WIDTH = 64;
const MAX_TOTAL_LOGICAL_CALLS = 200;
const MAX_ANSWER_CHARS = 1_000;
const TASK_BLOCK_SIZE = 1_000;
const BUDGET_OR_RATE_STATUSES: ReadonlySet<number> = new Set([402, 429,]);
const ANSWER_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'arithmetic_answer',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['answer',],
      properties: { answer: { type: 'integer', }, },
    },
  },
} as const;

type Provider = 'synthetic' | 'hyper';
type LogicalCallObservation = {
  readonly kind: 'valid' | 'invalid' | 'schema-mismatch' | 'refusal-shaped' | 'rejected';
  readonly elapsedMs: number;
  readonly chars?: number;
  readonly errorType?: string;
};

function requiredEnvironment({ name, }: { readonly name: string; }): string {
  const value = process.env[name] ?? '';
  if (value === '')
    throw new Error(`${name} is required`);
  return value;
}

function positiveInteger({ written, name, }: { readonly written: string; readonly name: string; }): number {
  const value = Number(written,);
  if ((!Number.isSafeInteger(value,)) || (value < 1) || (String(value,) !== written))
    throw new Error(`${name} must be canonical positive integer`);
  return value;
}

function readWidths(): readonly number[] {
  const widths = requiredEnvironment({ name: WIDTHS_VAR, })
    .split(',',)
    .map(function readWidth(written,): number {
      return positiveInteger({ written, name: WIDTHS_VAR, });
    },);
  if (widths.some(function tooWide(width,) { return width > MAX_PROBE_WIDTH; },))
    throw new Error(`${WIDTHS_VAR} width exceeds ${String(MAX_PROBE_WIDTH,)}`);
  const total = widths.reduce(function sum(accumulated, width,) { return accumulated + width; }, 0,);
  if (total > MAX_TOTAL_LOGICAL_CALLS)
    throw new Error(`${WIDTHS_VAR} total exceeds ${String(MAX_TOTAL_LOGICAL_CALLS,)}`);
  return widths;
}

function median({ values, }: { readonly values: readonly number[]; }): number | null {
  if (values.length === 0)
    return null;
  const sorted = values.toSorted(function ascending(left, right,) { return left - right; },);
  const middle = Math.floor(sorted.length / 2,);
  if ((sorted.length % 2) === 1)
    return sorted[middle] ?? null;
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return (lower === undefined) || (upper === undefined) ? null : (lower + upper) / 2;
}

function isAnswer(value: unknown,): value is { readonly answer: number; } {
  return (typeof value === 'object')
    && (value !== null)
    && (Object.keys(value,).length === 1)
    && ('answer' in value)
    && (typeof value.answer === 'number')
    && Number.isSafeInteger(value.answer,);
}

function minimum({ values, }: { readonly values: readonly number[]; }): number | null {
  return values.length === 0 ? null : Math.min(...values,);
}

function maximum({ values, }: { readonly values: readonly number[]; }): number | null {
  return values.length === 0 ? null : Math.max(...values,);
}

const providerWritten = requiredEnvironment({ name: PROVIDER_VAR, });
if ((providerWritten !== 'synthetic') && (providerWritten !== 'hyper'))
  throw new Error(`${PROVIDER_VAR} must be synthetic or hyper`);
const provider: Provider = providerWritten;
const modelWritten = requiredEnvironment({ name: MODEL_VAR, });
const model = ROSTER_MODEL_IDS.find(function sameId(modelId,) { return modelId === modelWritten; },);
if (model === undefined)
  throw new Error(`${MODEL_VAR} is not active roster model`);
const modelId: RosterModelId = model;
if ((provider === 'synthetic') && (!syntheticServes(modelId,)))
  throw new Error(`${MODEL_VAR} is not served by Synthetic`);
if ((provider === 'hyper') && (!hyperIdFor({ modelId, }).served))
  throw new Error(`${MODEL_VAR} is not served by Hyper`);
const widths = readWidths();
if ((process.env[STRUCTURED_VAR] === '1') && (widths[0] !== 1))
  throw new Error(`${WIDTHS_VAR} must begin with width 1 in structured mode`);
const timeoutWritten = process.env[TIMEOUT_VAR] ?? String(DEFAULT_TIMEOUT_MS,);
const exchangeTimeoutMs = positiveInteger({ written: timeoutWritten, name: TIMEOUT_VAR, });
const taskBase = positiveInteger({ written: requiredEnvironment({ name: TASK_BASE_VAR, }), name: TASK_BASE_VAR, });
const structuredWritten = process.env[STRUCTURED_VAR] ?? '0';
if ((structuredWritten !== '0') && (structuredWritten !== '1'))
  throw new Error(`${STRUCTURED_VAR} must be 0 or 1`);
const structured = structuredWritten === '1';
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
let transportInFlight = 0;
let transportPeak = 0;
let transportAttempts = 0;
const statusCounts = new Map<number, number>();
const transportErrorCounts = new Map<string, number>();

const measuredTransport: ModelTransport = async function measureTransport(exchange,): Promise<TransportReply> {
  transportAttempts += 1;
  transportInFlight += 1;
  transportPeak = Math.max(transportPeak, transportInFlight,);
  try {
    const reply = await fetchTransport(exchange,);
    statusCounts.set(reply.status, (statusCounts.get(reply.status,) ?? 0) + 1,);
    return reply;
  }
  catch (error) {
    const kind = error instanceof Error ? error.constructor.name : 'unknown';
    transportErrorCounts.set(kind, (transportErrorCounts.get(kind,) ?? 0) + 1,);
    throw error;
  }
  finally {
    transportInFlight -= 1;
  }
};

const apiKey = provider === 'synthetic'
  ? requiredEnvironment({ name: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY', })
  : requiredEnvironment({ name: 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY', });
const client = provider === 'synthetic'
  ? createSyntheticClient({ apiKey, transport: measuredTransport, perModelConcurrency: MAX_LOCAL_CONCURRENCY, },)
  : createHyperClient({ apiKey, transport: measuredTransport, perModelConcurrency: MAX_LOCAL_CONCURRENCY, },);
console.log(JSON.stringify({
  kind: 'provider-concurrency-plan',
  provider,
  modelId,
  widths,
  exchangeTimeoutMs,
  taskBase,
  structured,
  maxAnswerChars: MAX_ANSWER_CHARS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  scope: 'end-to-end model behavior, not isolated provider admission',
},),);

let taskOrdinal = 0;
let structuredControlPassed = false;
for (const [armIndex, width,] of widths.entries()) {
  if (structured && (width > 1) && (!structuredControlPassed))
    throw new Error('structured width-1 positive control did not pass');
  if (transportInFlight !== 0)
    throw new Error('transport calls remained in flight between arms');
  const armStarted = Date.now();
  const attemptsBefore = transportAttempts;
  const statusBefore = new Map(statusCounts,);
  const errorsBefore = new Map(transportErrorCounts,);
  transportPeak = 0;
  const calls = Array.from({ length: width, }, function makeCall() {
    taskOrdinal += 1;
    const ordinal = taskOrdinal;
    const left = (taskBase * TASK_BLOCK_SIZE) + ordinal;
    const right = (taskBase * TASK_BLOCK_SIZE * 2) + (ordinal * 2);
    if ((!Number.isSafeInteger(left,)) || (!Number.isSafeInteger(right,)))
      throw new Error(`${TASK_BASE_VAR} task range exceeds safe integer`);
    const expected = String(left + right,);
    return async function call(): Promise<LogicalCallObservation> {
      const started = Date.now();
      try {
        const messages = [{
          role: 'user' as const,
          content: structured
            ? `Add ${String(left,)} and ${String(right,)}. Return result in answer field.`
            : `Add ${String(left,)} and ${String(right,)}. Return decimal digits only.`,
        },];
        if (structured) {
          const outcome = await client.chatJson({
            modelId,
            messages,
            signal: controller.signal,
            exchangeTimeoutMs,
            maxAnswerChars: MAX_ANSWER_CHARS,
            responseFormat: ANSWER_RESPONSE_FORMAT,
            validate: isAnswer,
          },);
          return {
            kind: outcome.kind === 'ok'
              ? (outcome.value.answer === Number(expected,) ? 'valid' : 'invalid')
              : outcome.kind,
            elapsedMs: Date.now() - started,
            chars: outcome.rawText.length,
          };
        }
        const reply = await client.chatText({
          modelId,
          messages,
          signal: controller.signal,
          exchangeTimeoutMs,
          maxAnswerChars: MAX_ANSWER_CHARS,
        },);
        return {
          kind: reply.text.trim() === expected ? 'valid' : 'invalid',
          elapsedMs: Date.now() - started,
          chars: reply.text.length,
        };
      }
      catch (error) {
        if (controller.signal.aborted)
          throw controller.signal.reason;
        return {
          kind: 'rejected',
          elapsedMs: Date.now() - started,
          errorType: error instanceof Error ? error.constructor.name : 'unknown',
        };
      }
    };
  },);
  const observations = await Promise.all(calls.map(function start(call,) { return call(); },),);
  const elapsedAll = observations.map(function elapsedOf(observation,) { return observation.elapsedMs; },);
  const valid = observations.filter(function isValid(observation,) { return observation.kind === 'valid'; },);
  const invalid = observations.filter(function isInvalid(observation,) { return observation.kind === 'invalid'; },);
  const schemaMismatch = observations.filter(function isMismatch(observation,) {
    return observation.kind === 'schema-mismatch';
  },);
  const refusalShaped = observations.filter(function isRefusal(observation,) {
    return observation.kind === 'refusal-shaped';
  },);
  const rejected = observations.filter(function isRejected(observation,) { return observation.kind === 'rejected'; },);
  if (structured && (width === 1) && (valid.length === 1))
    structuredControlPassed = true;
  const statuses = [...statusCounts.entries(),].flatMap(function changed([status, count,],) {
    const delta = count - (statusBefore.get(status,) ?? 0);
    return delta === 0 ? [] : [[status, delta,] as const,];
  },);
  const transportErrors = [...transportErrorCounts.entries(),].flatMap(function changed([kind, count,],) {
    const delta = count - (errorsBefore.get(kind,) ?? 0);
    return delta === 0 ? [] : [[kind, delta,] as const,];
  },);
  const attempts = transportAttempts - attemptsBefore;
  console.log(JSON.stringify({
    kind: 'provider-concurrency-arm',
    provider,
    modelId,
    armIndex,
    width,
    structured,
    wallMs: Date.now() - armStarted,
    valid: valid.length,
    invalid: invalid.length,
    schemaMismatch: schemaMismatch.length,
    refusalShaped: refusalShaped.length,
    rejected: rejected.length,
    rejectionTypes: rejected.map(function errorType(observation,) { return observation.errorType ?? 'unknown'; },),
    logicalElapsedMinMs: minimum({ values: elapsedAll, },),
    logicalElapsedMedianMs: median({ values: elapsedAll, },),
    logicalElapsedMaxMs: maximum({ values: elapsedAll, },),
    transportAttempts: attempts,
    retryAttempts: Math.max(0, attempts - width,),
    localTransportPeak: transportPeak,
    statuses,
    transportErrors,
  },),);
  if (statuses.some(function budgetOrRate([status,],) { return BUDGET_OR_RATE_STATUSES.has(status,); },)) {
    console.log(JSON.stringify({ kind: 'provider-concurrency-stop', reason: 'budget-or-rate-status', },),);
    break;
  }
}

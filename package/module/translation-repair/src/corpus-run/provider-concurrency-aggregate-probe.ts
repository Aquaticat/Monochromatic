// PROTOTYPE ONLY: live Synthetic aggregate concurrency measurement.

import type { RosterModelId, } from '../roster-id.ts';
import { ROSTER_MODEL_IDS, } from '../roster-reach.ts';
import { createSyntheticClient, } from '../synthetic-client.ts';
import { syntheticServes, } from '../synthetic-catalog.ts';
import {
  fetchTransport,
  type ModelTransport,
  type TransportReply,
} from '../synthetic-transport.ts';

const PLAN_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_MODEL_WIDTHS';
const TASK_BASE_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_TASK_BASE';
const REPEATS_VAR = 'TRANSLATION_REPAIR_CONCURRENCY_REPEATS';
const MAX_TOTAL_CALLS = 100;
const MAX_LOCAL_CONCURRENCY = 128;
const TASK_BLOCK_SIZE = 1_000;
const EXCHANGE_TIMEOUT_MS = 120_000;
const MAX_ANSWER_CHARS = 1_000;
const ZERO_RETRY_POLICY = { limit: 0, baseMs: 1_000, } as const;
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

type PlannedModel = { readonly modelId: RosterModelId; readonly width: number; };
type Observation = {
  readonly modelId: RosterModelId;
  readonly kind: 'valid' | 'invalid' | 'schema-mismatch' | 'refusal-shaped' | 'rejected';
  readonly elapsedMs: number;
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

function activeSyntheticModel({ written, }: { readonly written: string; }): RosterModelId {
  const model = ROSTER_MODEL_IDS.find(function same(modelId,) { return modelId === written; },);
  if ((model === undefined) || (!syntheticServes(model,)))
    throw new Error(`${PLAN_VAR} includes model not active on Synthetic`);
  return model;
}

function readPlan(): readonly PlannedModel[] {
  const plan = requiredEnvironment({ name: PLAN_VAR, }).split(';').map(function parse(entry,): PlannedModel {
    const separator = entry.lastIndexOf('=',);
    if (separator < 1)
      throw new Error(`${PLAN_VAR} entry requires model=width`);
    return {
      modelId: activeSyntheticModel({ written: entry.slice(0, separator,), }),
      width: positiveInteger({ written: entry.slice(separator + 1,), name: PLAN_VAR, }),
    };
  },);
  if (new Set(plan.map(function id(row,) { return row.modelId; },),).size !== plan.length)
    throw new Error(`${PLAN_VAR} repeats model`);
  return plan;
}

function isAnswer(value: unknown,): value is { readonly answer: number; } {
  return (typeof value === 'object')
    && (value !== null)
    && (Object.keys(value,).length === 1)
    && ('answer' in value)
    && (typeof value.answer === 'number')
    && Number.isSafeInteger(value.answer,);
}

function incrementNested(
  {
    outer,
    key,
    item,
  }: {
    readonly outer: Map<string, Map<string, number>>;
    readonly key: string;
    readonly item: string;
  },
): void {
  const inner = outer.get(key,) ?? new Map<string, number>();
  inner.set(item, (inner.get(item,) ?? 0) + 1,);
  outer.set(key, inner,);
}

const plan = readPlan();
const repeats = positiveInteger({ written: process.env[REPEATS_VAR] ?? '1', name: REPEATS_VAR, });
const taskBase = positiveInteger({ written: requiredEnvironment({ name: TASK_BASE_VAR, }), name: TASK_BASE_VAR, });
const width = plan.reduce(function total(sum, row,) { return sum + row.width; }, 0,);
if (((width * repeats) + plan.length) > MAX_TOTAL_CALLS)
  throw new Error('aggregate probe total call bound exceeded');
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
let aggregateInFlight = 0;
let aggregatePeak = 0;
const perModelInFlight = new Map<string, number>();
const perModelPeak = new Map<string, number>();
const statusCounts = new Map<string, Map<string, number>>();
const transportErrors = new Map<string, Map<string, number>>();
let transportAttempts = 0;

const measuredTransport: ModelTransport = async function measure(exchange,): Promise<TransportReply> {
  transportAttempts += 1;
  aggregateInFlight += 1;
  aggregatePeak = Math.max(aggregatePeak, aggregateInFlight,);
  const modelInFlight = (perModelInFlight.get(exchange.label,) ?? 0) + 1;
  perModelInFlight.set(exchange.label, modelInFlight,);
  perModelPeak.set(exchange.label, Math.max(perModelPeak.get(exchange.label,) ?? 0, modelInFlight,),);
  try {
    const reply = await fetchTransport(exchange,);
    incrementNested({ outer: statusCounts, key: exchange.label, item: String(reply.status,), },);
    return reply;
  }
  catch (error) {
    incrementNested({
      outer: transportErrors,
      key: exchange.label,
      item: error instanceof Error ? error.constructor.name : 'unknown',
    },);
    throw error;
  }
  finally {
    aggregateInFlight -= 1;
    perModelInFlight.set(exchange.label, (perModelInFlight.get(exchange.label,) ?? 1) - 1,);
  }
};

const client = createSyntheticClient({
  apiKey: requiredEnvironment({ name: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY', }),
  transport: measuredTransport,
  perModelConcurrency: MAX_LOCAL_CONCURRENCY,
  retryPolicy: ZERO_RETRY_POLICY,
},);
let ordinal = 0;
async function runTask({ modelId, }: { readonly modelId: RosterModelId; }): Promise<Observation> {
  ordinal += 1;
  const left = (taskBase * TASK_BLOCK_SIZE) + ordinal;
  const right = (taskBase * TASK_BLOCK_SIZE * 2) + (ordinal * 2);
  const expected = left + right;
  if ((!Number.isSafeInteger(left,)) || (!Number.isSafeInteger(right,)) || (!Number.isSafeInteger(expected,)))
    throw new Error(`${TASK_BASE_VAR} task range exceeds safe integer`);
  const startedAt = Date.now();
  try {
    const outcome = await client.chatJson({
      modelId,
      messages: [{
        role: 'user',
        content: `Add ${String(left,)} and ${String(right,)}. Return result in answer field.`,
      },],
      signal: controller.signal,
      exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
      maxAnswerChars: MAX_ANSWER_CHARS,
      responseFormat: ANSWER_RESPONSE_FORMAT,
      validate: isAnswer,
    },);
    return {
      modelId,
      kind: outcome.kind === 'ok'
        ? (outcome.value.answer === expected ? 'valid' : 'invalid')
        : outcome.kind,
      elapsedMs: Date.now() - startedAt,
    };
  }
  catch (error) {
    if (controller.signal.aborted)
      throw controller.signal.reason;
    return { modelId, kind: 'rejected', elapsedMs: Date.now() - startedAt, };
  }
}

console.log(JSON.stringify({
  kind: 'provider-concurrency-aggregate-plan',
  plan,
  repeats,
  taskBase,
  retryPolicy: ZERO_RETRY_POLICY,
},),);
const controls: Observation[] = [];
for (const row of plan) {
  const control = await runTask({ modelId: row.modelId, },);
  controls.push(control,);
  console.log(JSON.stringify({
    kind: 'provider-concurrency-aggregate-control',
    modelId: control.modelId,
    outcomeKind: control.kind,
    elapsedMs: control.elapsedMs,
  },),);
  if (control.kind !== 'valid')
    throw new Error(`structured width-1 control failed for ${row.modelId}`);
}

for (let repeat = 0; repeat < repeats; repeat += 1) {
  if (aggregateInFlight !== 0)
    throw new Error('transport calls remained in flight between aggregate arms');
  aggregatePeak = 0;
  perModelPeak.clear();
  statusCounts.clear();
  transportErrors.clear();
  const startedAt = Date.now();
  const attemptsBefore = transportAttempts;
  const calls = plan.flatMap(function modelCalls(row,) {
    return Array.from({ length: row.width, }, function makeCall() {
      return function call() { return runTask({ modelId: row.modelId, },); };
    },);
  },);
  const observations = await Promise.all(calls.map(function start(call,) { return call(); },),);
  const resultByModel = Object.fromEntries(plan.map(function summarize(row,) {
    const rows = observations.filter(function same(observation,) { return observation.modelId === row.modelId; },);
    return [row.modelId, {
      valid: rows.filter(function valid(value,) { return value.kind === 'valid'; },).length,
      invalid: rows.filter(function invalid(value,) { return value.kind === 'invalid'; },).length,
      schemaMismatch: rows.filter(function mismatch(value,) { return value.kind === 'schema-mismatch'; },).length,
      refusalShaped: rows.filter(function refusal(value,) { return value.kind === 'refusal-shaped'; },).length,
      rejected: rows.filter(function rejected(value,) { return value.kind === 'rejected'; },).length,
      elapsedMaxMs: Math.max(...rows.map(function elapsed(value,) { return value.elapsedMs; },),),
    },] as const;
  },),);
  const statuses = Object.fromEntries([...statusCounts.entries(),].map(function statusEntry([modelId, counts,],) {
    return [modelId, Object.fromEntries(counts,),] as const;
  },),);
  console.log(JSON.stringify({
    kind: 'provider-concurrency-aggregate-arm',
    repeat,
    width,
    wallMs: Date.now() - startedAt,
    transportAttempts: transportAttempts - attemptsBefore,
    aggregateLocalTransportPeak: aggregatePeak,
    perModelLocalTransportPeak: Object.fromEntries(perModelPeak,),
    resultByModel,
    statuses,
    transportErrors: Object.fromEntries([...transportErrors.entries(),].map(function errorEntry([modelId, counts,],) {
      return [modelId, Object.fromEntries(counts,),] as const;
    },),),
  },),);
  const limited = [...statusCounts.values(),].some(function hasLimit(counts,) {
    return (counts.has('402',)) || (counts.has('429',));
  },);
  if (limited) {
    console.log(JSON.stringify({ kind: 'provider-concurrency-aggregate-stop', reason: 'budget-or-rate-status', },),);
    break;
  }
}

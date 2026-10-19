/**
 Private compile probe keeps the genuine judgment factory binding
 and the wrapper input shapes checkable without casts. @module
 */
import type { createJudgmentConstructor } from '../program-rule-batch-sdk-copy-v2/input/judgment-constructor.ts';
import { createRequestProducerOwner } from './owner.ts';
import type {
  JudgmentConstructionEntry,
  ProducerInvocation,
  ProducerRequest,
  ProducerStream
} from './owner-types.ts';

/**
 Genuine production judgment factories are typed by the real constructor result.
 */
declare const genuineJudgmentFactory: ReturnType<typeof createJudgmentConstructor>;

/**
 Original bound producer stream is the SDK stream the wrappers invoke.
 */
declare const boundStream: ProducerStream;

/**
 Original SDK model is supplied by the agent loop.
 */
declare const sdkModel: ProducerRequest[0];

/**
 Original SDK transcript context is supplied by the agent loop.
 */
declare const sdkContext: ProducerRequest[1];

/**
 Bind one original SDK request through the declared producer stream.

 @returns original producer stream for this probe
 */
function probeStream(): Promise<ProducerStream> {
  return Promise.resolve(boundStream);
}

/**
 Original probe clock returns one fixed start time.

 @returns original probe start time
 */
function probeClock(): number {
  return 0;
}

/**
 Wrapper inputs omit the request kind because the wrappers select it themselves.
 */
const wrapperInvocation: ProducerInvocation = {
  stream: probeStream,
  model: sdkModel,
  context: sdkContext,
  options: undefined
};

/**
 Genuine production judgment factories must bind to the generic producer owner
 without casts or invented facade types.
 */
const probeOwner = createRequestProducerOwner({
  now: probeClock,
  createJudgment: genuineJudgmentFactory
});

/**
 Lightweight semantic test judgments keep their optional prepared-group entry.
 */
declare const testJudgmentConstructor: (input: JudgmentConstructionEntry) => object;

/**
 Optional-group constructors must remain bindable for the lightweight test judgments.
 */
const testOwner = createRequestProducerOwner({
  now: probeClock,
  createJudgment: testJudgmentConstructor
});

/**
 Probe surfaces stay referenced so the module remains a pure compile consumer.
 */
export const producerContractProbe: {
  readonly probeOwner: unknown;
  readonly testOwner: unknown;
  readonly wrapperInvocation: ProducerInvocation;
} = Object.freeze({
  probeOwner,
  testOwner,
  wrapperInvocation
});

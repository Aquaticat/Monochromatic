/**
 Test-only full native dispatch capture preserves callback and stream identities. @module
 */
import {
  type AssistantMessageEventStream,
  createAssistantMessageEventStream,
  type Model,
  type OpenAICodexResponsesOptions,
  type StreamFunction,
  type TranscriptContext,
} from '@earendil-works/pi-ai';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 Native invocation retains exact caller objects for post-dispatch assertions.
 */
export type StreamFixtureCall = {
  readonly model: ForeignBorrowed<Model<'openai-codex-responses'>>;
  readonly context: ForeignBorrowed<TranscriptContext>;
  readonly options?: ForeignBorrowed<OpenAICodexResponsesOptions>;
};

/**
 Local dispatcher exposes owned invocation state and unwrapped native stream.
 */
export type StreamFixtureDispatch = {
  readonly stream: StreamFunction<'openai-codex-responses', OpenAICodexResponsesOptions>;
  readonly calls: readonly StreamFixtureCall[];
  readonly events: AssistantMessageEventStream;
};

//region Native signature: capture foreign input without altering its ownership.

/**
 Create standalone dispatcher without patching host modules or shared state.

 @returns independently owned dispatch recorder

 @internal
 */
export function createStreamFixtureDispatch(): StreamFixtureDispatch {
  /**
   Owned call records retain foreign input identities without modifying them.
   */
  const calls: StreamFixtureCall[] = [];
  /**
   Result identity detects accidental stream wrapping or alternate dispatch.
   */
  const events = createAssistantMessageEventStream();

  return {
    calls,
    events,
    /**
     Record native callback invocation using upstream positional signature.

     @param model - exact live model borrowed from native dispatch

     @param context - normalized transcript borrowed from native dispatch

     @param options - composed full options borrowed from native dispatch

     @returns original fixture stream unchanged
     */
    stream: function captureStream(
      model: ForeignBorrowed<Model<'openai-codex-responses'>>,
      context: ForeignBorrowed<TranscriptContext>,
      options?: ForeignBorrowed<OpenAICodexResponsesOptions>,
    ): AssistantMessageEventStream {
      calls.push({
        model,
        context,
        ...(options === undefined ? {} : { options, }),
      },);
      return events;
    },
  };
}

//endregion Native signature
